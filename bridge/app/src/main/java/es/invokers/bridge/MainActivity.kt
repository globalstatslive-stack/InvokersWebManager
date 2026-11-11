package es.invokers.bridge

import android.app.Activity
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.IBinder
import android.os.ParcelFileDescriptor
import android.text.InputType
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.FileProvider
import rikka.shizuku.Shizuku
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** Dos entradas de solo lectura: snapshots locales y enlace público del portal oficial. */
class MainActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var linkInput: EditText
    @Volatile private var connecting = false
    @Volatile private var downloading = false
    private val requestCode = 100
    private val permissionResult = Shizuku.OnRequestPermissionResultListener { code, result ->
        if (code == requestCode) {
            if (result == PackageManager.PERMISSION_GRANTED) bindReader()
            else show("Permiso denegado. Autoriza Invokers Bridge en Shizuku.")
        }
    }
    private val binderReady = Shizuku.OnBinderReceivedListener { refresh() }
    private val binderDead = Shizuku.OnBinderDeadListener { if (!downloading) show("Shizuku se ha detenido. Puedes importar por enlace o iniciarlo de nuevo para leer los .dat.") }
    private val args by lazy { Shizuku.UserServiceArgs(ComponentName(packageName, SnapshotReaderService::class.java.name)).daemon(false).processNameSuffix("reader").debuggable(BuildConfig.DEBUG).version(BuildConfig.VERSION_CODE) }
    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            if (!binder.pingBinder()) { connecting = false; show("El lector de Shizuku no responde."); return }
            show("Leyendo archivos sin modificar el juego…")
            Thread {
                try { readAndShare(IReader.Stub.asInterface(binder)) }
                catch (e: Exception) { show("Error al leer: ${e.message ?: e.javaClass.simpleName}") }
                finally { connecting = false }
            }.start()
        }
        override fun onServiceDisconnected(name: ComponentName) { connecting = false; show("Se perdió la conexión con Shizuku.") }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (24 * resources.displayMetrics.density).toInt()
        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad * 2, pad, pad); setBackgroundColor(0xff101827.toInt()) }
        fun add(message: String, size: Float, color: Int): TextView = TextView(this).apply {
            text = message; textSize = size; setTextColor(color)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = pad }
            column.addView(this)
        }
        add("INVOKERS BRIDGE", 14f, 0xffe8bd73.toInt())
        add("Tu colección en la web", 28f, -1)
        add("Importa un enlace oficial compartido o lee los archivos del juego con Shizuku. No solicita contraseña ni modifica el juego.", 16f, 0xffc2cedb.toInt())
        status = add("Preparando importación…", 15f, 0xffe8bd73.toInt())
        add("ENLACE OFICIAL · SIN SHIZUKU", 13f, 0xffe8bd73.toInt())
        linkInput = EditText(this).apply {
            hint = "https://invokers.com/lamb/?b=…"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setTextColor(0xffe6edf5.toInt())
            setHintTextColor(0xffa3b3c4.toInt())
            textSize = 14f
            isSingleLine = true
            isSaveEnabled = false
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
            contentDescription = "Enlace oficial de colección compartida"
        }
        column.addView(linkInput)
        column.addView(Button(this).apply { text = "IMPORTAR ENLACE Y ABRIR LA WEB"; setOnClickListener { importLink(linkInput.text.toString()) } })
        add("Se descargará únicamente la colección de ese enlace desde invokers.com. La copia JSON se entrega a la web en tu dispositivo. El enlace puede caducar y no se renueva desde este puente.", 13f, 0xffa3b3c4.toInt())
        add("ARCHIVOS DEL JUEGO · CON SHIZUKU", 13f, 0xffe8bd73.toInt())
        column.addView(Button(this).apply { text = "LEER Y COMPARTIR SNAPSHOTS"; setOnClickListener { begin() } })
        column.addView(Button(this).apply { text = "CAMBIAR DESTINO DE COMPARTIR"; setOnClickListener {
            getSharedPreferences("share-target", MODE_PRIVATE).edit().remove("component").apply()
            show("Destino olvidado. En la próxima lectura podrás elegir la PWA en Compartir.")
        } })
        column.addView(Button(this).apply { text = "BORRAR COPIAS TEMPORALES"; setOnClickListener {
            if (connecting || downloading) show("Espera a que termine la importación antes de borrar las copias.")
            else { File(cacheDir, "shares").deleteRecursively(); show("Copias temporales del puente borradas.") }
        } })
        add("La primera vez, selecciona Invokers Web Manager en Compartir. La web guardará los archivos automáticamente. Si Android lo permite, el puente recordará tu elección para la próxima lectura.", 14f, 0xffa3b3c4.toInt())
        add("Tras reiniciar el teléfono, Shizuku puede necesitar que actives otra vez la depuración inalámbrica.", 14f, 0xffa3b3c4.toInt())
        setContentView(ScrollView(this).apply { addView(column); isFillViewport = true })
        Shizuku.addBinderReceivedListenerSticky(binderReady)
        Shizuku.addBinderDeadListener(binderDead)
        Shizuku.addRequestPermissionResultListener(permissionResult)
        refresh()
        if (savedInstanceState == null) receiveLink(intent)
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        receiveLink(intent)
    }
    private fun show(message: String) = runOnUiThread { if (::status.isInitialized && !isDestroyed) status.text = message }
    private fun refresh() {
        if (connecting || downloading) return
        show(if (runCatching { Shizuku.pingBinder() }.getOrDefault(false)) "Listo para importar un enlace o leer los .dat con Shizuku." else "Listo para importar por enlace. Para leer los .dat, inicia Shizuku.")
    }
    private fun receiveLink(incoming: Intent?) {
        val text = when (incoming?.action) {
            Intent.ACTION_VIEW -> {
                val uri = incoming.data ?: return
                if (uri.scheme != "invokersbridge" || uri.host != "import" || uri.userInfo != null || uri.port != -1 ||
                    !uri.path.isNullOrEmpty() || uri.fragment != null || uri.queryParameterNames != setOf("url") ||
                    uri.getQueryParameters("url").size != 1) {
                    show("La solicitud de importación no tiene un enlace oficial válido.")
                    return
                }
                uri.getQueryParameter("url") ?: return
            }
            Intent.ACTION_SEND -> if (incoming.type == "text/plain") incoming.getStringExtra(Intent.EXTRA_TEXT)?.trim() else null
            else -> null
        } ?: return
        // El token no se conserva en preferencias ni en el Intent de la actividad.
        setIntent(Intent(this, MainActivity::class.java))
        linkInput.setText(text)
        importLink(text)
    }
    private fun importLink(link: String) {
        if (connecting || downloading) { show("Ya hay una importación en curso."); return }
        try { SharedLinkPolicy.token(link) }
        catch (e: IllegalArgumentException) { show(e.message ?: "Enlace oficial no válido."); return }
        downloading = true
        show("Descargando la colección compartida desde invokers.com…")
        Thread {
            val directory = File(cacheDir, "shares/${UUID.randomUUID()}")
            try {
                require(directory.mkdirs()) { "No se pudo preparar el almacenamiento local" }
                val partial = File(directory, "invokers-shared-box.json.tmp")
                FileOutputStream(partial).use { SharedBoxDownloader().download(link, it) }
                val destination = File(directory, "invokers-shared-box.json")
                require(partial.renameTo(destination)) { "No se pudo preparar la colección" }
                val uri = FileProvider.getUriForFile(this, "$packageName.files", destination)
                shareFiles(arrayListOf(uri), "application/json", "Colección oficial descargada")
            } catch (e: Exception) {
                directory.deleteRecursively()
                show(if (e is SharedBoxException) e.message ?: "No se pudo descargar la colección." else "No se pudo preparar la importación. Vuelve a intentarlo.")
            } finally { downloading = false }
        }.start()
    }
    private fun begin() {
        if (connecting || downloading) return
        if (!runCatching { Shizuku.pingBinder() }.getOrDefault(false)) { refresh(); return }
        when {
            Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED -> bindReader()
            Shizuku.shouldShowRequestPermissionRationale() -> show("Autoriza el puente desde Shizuku.")
            else -> { show("Esperando autorización de Shizuku…"); Shizuku.requestPermission(requestCode) }
        }
    }
    private fun bindReader() {
        if (connecting) return
        connecting = true; show("Conectando con Shizuku…")
        try { Shizuku.bindUserService(args, connection) }
        catch (e: Exception) { connecting = false; show("No se pudo conectar: ${e.message}") }
    }
    private fun readAndShare(reader: IReader) {
        val names = reader.listSnapshots()
        require(names.isNotEmpty() && names.size <= 100) { "No se encontraron .dat válidos o hay demasiados archivos" }
        val directory = File(cacheDir, "shares/${UUID.randomUUID()}").apply { mkdirs() }
        val uris = ArrayList<android.net.Uri>()
        var batchBytes = 0L
        for (name in names) {
            SnapshotPolicy.validate(name)
            val destination = File(directory, name)
            val temp = File(directory, "$name.tmp")
            var fileBytes = 0L
            reader.openSnapshot(name).use { fd ->
                ParcelFileDescriptor.AutoCloseInputStream(fd).use { input ->
                    FileOutputStream(temp).use { output ->
                        val buffer = ByteArray(32 * 1024)
                        while (true) {
                            val n = input.read(buffer)
                            if (n < 0) break
                            fileBytes += n; batchBytes += n
                            require(fileBytes <= SnapshotPolicy.MAX_FILE_BYTES && batchBytes <= SnapshotPolicy.MAX_BATCH_BYTES) { "Límite de lectura superado" }
                            output.write(buffer, 0, n)
                        }
                    }
                }
            }
            require(temp.renameTo(destination)) { "No se pudo preparar $name" }
            uris.add(FileProvider.getUriForFile(this, "$packageName.files", destination))
        }
        shareFiles(uris, "application/octet-stream", "${uris.size} archivos leídos")
    }
    private fun shareFiles(uris: ArrayList<android.net.Uri>, mime: String, message: String) {
        runOnUiThread {
            if (isFinishing || isDestroyed) return@runOnUiThread
            val send = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                type = mime
                putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                clipData = ClipData.newUri(contentResolver, "Snapshots de Invokers", uris.first()).also { clip -> uris.drop(1).forEach { clip.addItem(ClipData.Item(it)) } }
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val saved = getSharedPreferences("share-target", MODE_PRIVATE).getString("component", null)
                ?.let(ComponentName::unflattenFromString)
            if (saved != null && isInvokersWebApk(this, saved.packageName)) {
                try {
                    startActivity(Intent(send).setComponent(saved))
                    show("$message. Abriendo Invokers Web Manager para validar y guardar…")
                    return@runOnUiThread
                } catch (_: ActivityNotFoundException) {
                    getSharedPreferences("share-target", MODE_PRIVATE).edit().remove("component").apply()
                } catch (_: SecurityException) {
                    getSharedPreferences("share-target", MODE_PRIVATE).edit().remove("component").apply()
                }
            }
            val callback = PendingIntent.getBroadcast(
                this, 0, Intent(this, ShareTargetReceiver::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            show("$message. Elige Invokers Web Manager en Compartir; la web validará la importación.")
            startActivity(Intent.createChooser(send, "Compartir con Invokers Web Manager", callback.intentSender))
        }
    }
    override fun onDestroy() {
        Shizuku.removeBinderReceivedListener(binderReady)
        Shizuku.removeBinderDeadListener(binderDead)
        Shizuku.removeRequestPermissionResultListener(permissionResult)
        super.onDestroy()
    }
}
