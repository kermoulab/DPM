# Proguard / R8 rules for Vectis ERP Android Application

# Retain Retrofit and OkHttp classes and annotations
-dontwarn okhttp3.**
-dontwarn okio.**
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Retain Gson model classes
-keep class com.vectis.erp.data.model.** { *; }

# Obfuscate & strip log calls in release builds
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
}
