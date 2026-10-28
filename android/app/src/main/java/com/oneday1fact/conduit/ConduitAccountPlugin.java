package com.oneday1fact.conduit;

import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Native account chooser; the ID token is exchanged with Firebase, never persisted by this bridge. */
@CapacitorPlugin(name="ConduitAccount")
public class ConduitAccountPlugin extends Plugin {
    @PluginMethod public void google(PluginCall call) {
        String clientId=call.getString("clientId");
        if(clientId==null || !clientId.endsWith(".apps.googleusercontent.com")) {
            call.reject("Google sign-in is not configured in this build."); return;
        }
        getActivity().runOnUiThread(()->{
            GetSignInWithGoogleOption option=new GetSignInWithGoogleOption.Builder(clientId).build();
            GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(option).build();
            CredentialManager.create(getContext()).getCredentialAsync(getActivity(),request,null,
                ContextCompat.getMainExecutor(getContext()),new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>() {
                    @Override public void onResult(GetCredentialResponse response) {
                        Credential credential=response.getCredential();
                        if(credential instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                            try {
                                String token=GoogleIdTokenCredential.createFrom(credential.getData()).getIdToken();
                                JSObject result=new JSObject();result.put("idToken",token);call.resolve(result);
                            } catch(Exception error) {call.reject("Google could not verify this account. Try again.");}
                        } else call.reject("No Google account was selected.");
                    }
                    @Override public void onError(GetCredentialException error) {
                        call.reject("Google sign-in was canceled or unavailable. Check this device's Google account and try again.");
                    }
                });
        });
    }
}
