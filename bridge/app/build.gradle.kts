plugins {
    id("com.android.application")
    kotlin("android")
}
android {
    namespace = "es.invokers.bridge"
    compileSdk = 36
    defaultConfig {
        applicationId = "es.invokers.bridge"
        minSdk = 31
        targetSdk = 36
        versionCode = 2
        versionName = "0.1.1"
    }
    buildFeatures { aidl = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_21; targetCompatibility = JavaVersion.VERSION_21 }
}
kotlin { jvmToolchain(21) }
dependencies {
    implementation("dev.rikka.shizuku:api:13.1.5")
    implementation("dev.rikka.shizuku:provider:13.1.5")
    implementation("androidx.core:core:1.17.0")
    testImplementation("junit:junit:4.13.2")
}
