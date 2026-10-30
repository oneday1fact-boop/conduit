package com.oneday1fact.conduit;

import android.os.Build;
import android.view.HapticFeedbackConstants;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Uses system touch feedback; respects Android's haptics and accessibility settings. */
@CapacitorPlugin(name="ConduitHaptics")
public class ConduitHapticsPlugin extends Plugin {
    @PluginMethod public void perform(PluginCall call) {
        String kind = call.getString("kind", "light");
        getActivity().runOnUiThread(() -> {
            int effect = HapticFeedbackConstants.VIRTUAL_KEY;
            if ("success".equals(kind)) effect = HapticFeedbackConstants.CONTEXT_CLICK;
            if ("complete".equals(kind)) effect = Build.VERSION.SDK_INT >= 30
                ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.LONG_PRESS;
            boolean performed = getBridge().getWebView().performHapticFeedback(effect);
            JSObject result = new JSObject();
            result.put("performed", performed);
            call.resolve(result);
        });
    }
}
