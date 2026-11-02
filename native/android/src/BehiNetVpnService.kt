package __BEHINET_PACKAGE__.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.app.NotificationCompat
import io.nekohasekai.libbox.Libbox
import io.nekohasekai.libbox.PlatformInterface
import io.nekohasekai.libbox.TunOptions
import java.util.concurrent.Executors

class BehiNetVpnService : VpnService(), PlatformInterface {
    private var tunFd: ParcelFileDescriptor? = null
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val config = intent?.getStringExtra("config_json")
        if (config.isNullOrBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }
        startForeground(1, buildNotification("BehiNet VPN", "Connecting..."))
        
        executor.execute {
            try {
                Libbox.setup(config, this, this, false)
                updateNotification("BehiNet VPN", "Connected")
            } catch (e: Exception) {
                e.printStackTrace()
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun openTun(options: TunOptions): Int {
        val builder = Builder()
            .setSession("BehiNet VPN")
            .setMtu(options.mtu)
            .addAddress("172.19.0.1", 30)
            .addRoute("0.0.0.0", 0)
            .addDnsServer("1.1.1.1")
            .addDnsServer("8.8.8.8")
        tunFd = builder.establish()
        return tunFd!!.fd
    }

    override fun onDestroy() {
        try { Libbox.closeService() } catch (_: Throwable) {}
        tunFd?.close()
        tunFd = null
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("vpn", "VPN Service", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(title: String, text: String): Notification {
        return NotificationCompat.Builder(this, "vpn")
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_vpn_ic)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(title: String, text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(1, buildNotification(title, text))
    }

    // متدهای اجباری PlatformInterface (بدون استفاده)
    override fun autoDetectInterfaceControl(fd: Int) {}
    override fun clearDNSCache() {}
    override fun closeDefaultInterfaceMonitor(listener: io.nekohasekai.libbox.InterfaceUpdateListener?) {}
    override fun findConnectionOwner(ipProtocol: Int, sourceAddress: String?, sourcePort: Int, destinationAddress: String?, destinationPort: Int): Int = 0
    override fun getInterfaces(): io.nekohasekai.libbox.NetworkInterfaceIterator? = null
    override fun includeAllNetworks(): Boolean = false
    override fun packageNameByUid(uid: Int): String? = null
    override fun readWIFIState(): io.nekohasekai.libbox.WIFIState? = null
    override fun sendNotification(notification: Notification) {}
    override fun startDefaultInterfaceMonitor(listener: io.nekohasekai.libbox.InterfaceUpdateListener?) {}
    override fun uidByPackageName(packageName: String?): Int = 0
    override fun underNetworkExtension(): Boolean = false
    override fun usePlatformAutoDetectInterfaceControl(): Boolean = false
    override fun useProcFS(): Boolean = false
    override fun writeLog(message: String?) {}
}
