package es.invokers.bridge

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build

/** Recuerda el WebAPK elegido por el usuario para los siguientes envíos. */
class ShareTargetReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val target = if (Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT, ComponentName::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT)
        } ?: return
        if (!isInvokersWebApk(context, target.packageName)) return
        context.getSharedPreferences("share-target", Context.MODE_PRIVATE).edit()
            .putString("component", target.flattenToString()).apply()
    }
}

internal fun isInvokersWebApk(context: Context, packageName: String): Boolean {
    if (!packageName.startsWith("org.chromium.webapk.")) return false
    return runCatching {
        val info = context.packageManager.getApplicationInfo(packageName, 0)
        val label = context.packageManager.getApplicationLabel(info).toString()
        label == "Invokers" || label == "Invokers Web Manager"
    }.getOrDefault(false)
}
