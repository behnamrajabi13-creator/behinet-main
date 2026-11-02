package __BEHINET_PACKAGE__.vpn

import android.content.Intent
import android.net.VpnService
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BehiNetVpnEngineModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "BehiNetVpnEngine"

    @ReactMethod
    fun start(configJson: String, promise: Promise) {
        try {
            val intent = VpnService.prepare(context)
            if (intent != null) {
                promise.reject("VPN_PERMISSION", "VPN permission not granted")
                return
            }
            val serviceIntent = Intent(context, BehiNetVpnService::class.java)
                .putExtra("config_json", configJson)
            ContextCompat.startForegroundService(context, serviceIntent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("VPN_START_ERROR", e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            context.stopService(Intent(context, BehiNetVpnService::class.java))
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("VPN_STOP_ERROR", e)
        }
    }
}
