# Yıldız Yarışları

Öğretmen ve öğrenciler için Firebase Realtime Database ile eşitlenen yıldız yarışı uygulaması.

## Bağlantılar

- Öğrenci görünümü ve PWA: `https://ebeveynleingilizce-sudo.github.io/yildiz-yarislari/`
- Öğretmen paneli ve ayrı PWA: `https://ebeveynleingilizce-sudo.github.io/yildiz-yarislari/?teacher=1`
- Mobil kurulum: uygulamayı HTTPS bağlantısından açıp üstteki 📲 düğmesine dokun. iPhone'da Safari paylaş menüsünden “Ana Ekrana Ekle”yi seç.

Öğrenci ve öğretmen sürümleri ayrı manifest, uygulama adı, simge ve kurulum kimliği kullanır. Öğretmen girişinde “Beni hatırla” seçeneği işaretlenirse öğretmen oturumu bu tarayıcıda kalıcı tutulur. Öğrenci ve öğretmen oturumları Firebase tarafında ayrı uygulama kimlikleriyle saklanır.

GitHub Actions, `main` dalına yapılan her gönderimde statik siteyi GitHub Pages'e yayınlar. `firebase-config.js` Firebase web ayarlarını içerir; veritabanı izinleri `database.rules.json` içinde yönetilir.

## Firebase Console gereksinimleri

1. Authentication'da Email/Password ve Anonymous giriş yöntemlerini etkinleştir.
2. Authentication > Settings > Authorized domains bölümüne `ebeveynleingilizce-sudo.github.io` ekle.
3. Realtime Database kurallarının yayımlanmış olduğunu doğrula.

Öğretmen oturumu için `?teacher=1` açılır ve öğretmen parolası yalnızca giriş formuna yazılır. Parola kaynak kodda tutulmaz.
