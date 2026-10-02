# Yıldız Yarışları

Öğretmen ve öğrenciler için Firebase Realtime Database ile eşitlenen yıldız yarışı uygulaması.

## Bağlantılar

- Öğrenci görünümü: `https://ebeveynleingilizce-sudo.github.io/yildiz-yarislari/`
- Öğretmen paneli: `https://ebeveynleingilizce-sudo.github.io/yildiz-yarislari/?teacher=1`

GitHub Actions, `main` dalına yapılan her gönderimde statik siteyi GitHub Pages'e yayınlar. `firebase-config.js` Firebase web ayarlarını içerir; veritabanı izinleri `database.rules.json` içinde yönetilir.

## Firebase Console gereksinimleri

1. Authentication'da Email/Password ve Anonymous giriş yöntemlerini etkinleştir.
2. Authentication > Settings > Authorized domains bölümüne `ebeveynleingilizce-sudo.github.io` ekle.
3. Realtime Database kurallarının yayımlanmış olduğunu doğrula.

Öğretmen oturumu için `?teacher=1` açılır ve öğretmen parolası yalnızca giriş formuna yazılır. Parola kaynak kodda tutulmaz.
