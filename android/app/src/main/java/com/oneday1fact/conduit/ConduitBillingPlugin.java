package com.oneday1fact.conduit;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.android.billingclient.api.*;
import java.util.List;
import java.util.function.Consumer;

/** Play only collects payment. Firebase verifies, acknowledges and grants access. */
@CapacitorPlugin(name = "ConduitBilling")
public class ConduitBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private static final String PRODUCT = "conduit_pro_lifetime";
    private BillingClient client;
    private PluginCall pendingPurchase;

    @Override public void load() {
        client = BillingClient.newBuilder(getContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }
    private boolean ok(BillingResult result) { return result.getResponseCode() == BillingClient.BillingResponseCode.OK; }
    private void connect(PluginCall call, Runnable operation) {
        getActivity().runOnUiThread(() -> {
            if (client.isReady()) { operation.run(); return; }
            client.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult result) {
                    if (ok(result)) operation.run(); else call.reject("Google Play Billing is unavailable on this install.");
                }
                @Override public void onBillingServiceDisconnected() { /* Next operation reconnects automatically. */ }
            });
        });
    }
    private void details(PluginCall call, Consumer<ProductDetails> callback) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(List.of(
            QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(BillingClient.ProductType.INAPP).build())).build();
        client.queryProductDetailsAsync(params, (result, response) -> {
            if (!ok(result) || response.getProductDetailsList().isEmpty()) { call.reject("Pro is not available in Google Play yet."); return; }
            callback.accept(response.getProductDetailsList().get(0));
        });
    }
    private ProductDetails.OneTimePurchaseOfferDetails offer(ProductDetails product) {
        List<ProductDetails.OneTimePurchaseOfferDetails> offers = product.getOneTimePurchaseOfferDetailsList();
        // Configure exactly one permanent buy option. No rentals, promotions or subscriptions.
        return offers != null && offers.size() == 1 ? offers.get(0) : null;
    }
    @PluginMethod public void product(PluginCall call) {
        connect(call, () -> details(call, product -> {
            ProductDetails.OneTimePurchaseOfferDetails offer = offer(product);
            if (offer == null) { call.reject("Pro purchase options are not configured yet."); return; }
            JSObject data = new JSObject(); data.put("price", offer.getFormattedPrice()); call.resolve(data);
        }));
    }
    @PluginMethod public void purchase(PluginCall call) {
        String account = call.getString("accountId");
        if (account == null || !account.matches("[a-f0-9]{64}")) { call.reject("Sign in before buying Pro."); return; }
        if (pendingPurchase != null) { call.reject("A purchase is already in progress."); return; }
        connect(call, () -> details(call, product -> {
            ProductDetails.OneTimePurchaseOfferDetails offer = offer(product);
            if (offer == null) { call.reject("Pro purchase options are not configured yet."); return; }
            getActivity().runOnUiThread(() -> {
                if (pendingPurchase != null) { call.reject("A purchase is already in progress."); return; }
                pendingPurchase = call;
                BillingFlowParams.ProductDetailsParams item = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(product).setOfferToken(offer.getOfferToken()).build();
                BillingResult result = client.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(List.of(item)).setObfuscatedAccountId(account).build());
                if (!ok(result)) { pendingPurchase = null; call.reject("Could not open Google Play. Try Restore purchases if you already own Pro."); }
            });
        }));
    }
    private JSObject purchaseData(Purchase purchase) {
        JSObject data = new JSObject(); data.put("token", purchase.getPurchaseToken()); data.put("state", purchase.getPurchaseState()); return data;
    }
    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        PluginCall call = pendingPurchase; pendingPurchase = null;
        if (ok(result) && purchases != null) {
            for (Purchase purchase : purchases) if (purchase.getProducts().contains(PRODUCT)) {
                if (call != null) call.resolve(purchaseData(purchase));
                notifyListeners("purchaseUpdated", purchaseData(purchase)); return;
            }
        }
        if (call != null) call.reject(result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED ? "Purchase canceled." : "Purchase could not complete. Try Restore purchases.");
    }
    @PluginMethod public void restore(PluginCall call) {
        connect(call, () -> client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> {
            if (!ok(result)) { call.reject("Could not check Google Play purchases."); return; }
            JSArray list = new JSArray();
            for (Purchase purchase : purchases) if (purchase.getProducts().contains(PRODUCT)) list.put(purchaseData(purchase));
            JSObject data = new JSObject(); data.put("purchases", list); call.resolve(data);
        }));
    }
    @Override protected void handleOnDestroy() {
        if (pendingPurchase != null) { pendingPurchase.reject("Purchase interrupted. Use Restore purchases after reopening."); pendingPurchase = null; }
        if (client != null) client.endConnection();
    }
}
