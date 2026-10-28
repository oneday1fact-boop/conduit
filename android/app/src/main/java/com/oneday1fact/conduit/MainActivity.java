package com.oneday1fact.conduit;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ConduitBillingPlugin.class);
        registerPlugin(ConduitAccountPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
