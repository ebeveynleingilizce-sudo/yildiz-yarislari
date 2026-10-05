# Yıldız Yarışları

Öğretmen ve öğrenciler için Firebase Realtime Database ile eşitlenen yıldız yarışı uygulaması.

## Bağlantılar

- Öğrenci görünümü ve PWA: `https://ebeveynleingilizce-sudo.github.io/yildiz-yarislari/`
- Öğretmen paneli ve ayrı PWA: `https://ebeveynleingilizce-sudo.github.io/yildiz-yarislari/?teacher=1`
- İzole Minecraft esintili öğretmen test ortamı: `https://ebeveynleingilizce-sudo.github.io/yildiz-yarislari/?teacher=1&test=1`
- Mobil kurulum: uygulamayı HTTPS bağlantısından açıp üstteki 📲 düğmesine dokun. iPhone'da Safari paylaş menüsünden “Ana Ekrana Ekle”yi seç.

Öğrenci ve öğretmen sürümleri ayrı manifest, uygulama adı, simge ve kurulum kimliği kullanır. Öğretmen girişi `?teacher=1` ile açılır; öğrenci bağlantısı varsayılan yarış için ana URL'dir. Öğretmen panelindeki **Öğrenci bağlantısını kopyala** düğmesi o öğretmen hesabına özel salt okunur bağlantıyı verir. Öğretmen girişinde “Beni hatırla” seçeneği işaretlenirse öğretmen oturumu bu tarayıcıda kalıcı tutulur.

GitHub Actions, `main` dalına yapılan her gönderimde statik siteyi GitHub Pages'e yayınlar. `firebase-config.js` Firebase web ayarlarını içerir; veritabanı izinleri `database.rules.json` içinde yönetilir. Her öğretmenin özel verisi `teacherData/{auth.uid}` altında tutulur. Öğrenci uygulaması yalnızca öğretmenin gizli paylaşım anahtarıyla açılan `sharedRosters/{token}` verisini okuyabilir. Öğretmen verileri cihazlardaki `localStorage` anahtarlarına UID veya paylaşım anahtarı eklenerek de ayrılır.

`?teacher=1&test=1` yalnızca öğretmen test ekranını açar; Minecraft esintili stil, ayrı `testTeacherData/{auth.uid}` Firebase alanı ve ayrı yerel depolama alanı kullanır. Bu test adresinde üretim öğrenci paylaşım listesi güncellenmez ve kurulum düğmesi kapalıdır. Test ve üretim öğretmen verileri aynı Firebase projesinde farklı UID korumalı köklerde saklanır.

## Firebase Console gereksinimleri

1. Authentication > Sign-in method altında **Email/Password**, **Anonymous** ve **Google** sağlayıcılarını etkinleştir. Google OAuth için görünen uygulama adını ve destek e-postasını yapılandır.
2. Authentication > Settings > Authorized domains bölümüne `ebeveynleingilizce-sudo.github.io` ekle.
3. Yeni `database.rules.json` kurallarını Realtime Database > Rules ekranına yayımla. Kurallar varsayılan olarak tüm veritabanı erişimini kapatır; öğretmen sadece kendi UID alanını yazar, öğrenciler yalnızca kendilerine gönderilen paylaşım yolunu okuyabilir.
4. Mevcut `tunc@test.com` hesabı ilk girişinde eski ortak listeyi yeni UID alanına taşımaya çalışır. Diğer öğretmen hesapları kendi boş/ayrı listeleriyle başlar. Firebase kurallarını yayımlamadan yeni sürümde giriş ve öğrenci bağlantısı veri okuyamaz.

Öğretmen oturumu için `?teacher=1` açılır ve öğretmen parolası yalnızca giriş formuna yazılır. Parola kaynak kodda tutulmaz. Google ile ilk giriş Firebase Authentication'da kullanıcı hesabı oluşturur; öğretmen modu anonim oturumları reddeder. Öğretmen, yıldız kazanma yollarını panelde satır satır düzenleyebilir: `emoji | başlık | açıklama | yıldız | aktif/pasif`. Satır ekleme yeni yol oluşturur; silme kaldırır.

## Testler ve doğrulama sınırları

Kaynak test komutu: `node --test tests/game.test.cjs`. Bu testler HTML/oyun kodunu, editör etkileşimlerini ve güvenlik kurallarının yapısal beklentilerini çalıştırır. Firebase Authentication, Realtime Database Rules Emulator ve gerçek cihaz PWA kurulumunu bu Node testleri doğrulamaz; gerçek Firebase hesaplarıyla giriş ve hesaplar arası izolasyon ayrıca doğrulanmalıdır.

## Öğrenci silme regresyon testleri

Yerel taklit Firebase verisiyle çalışır; gerçek hesaplara veya üretim verisine erişmez.

```sh
npm ci
npx playwright install chromium webkit
npm test
```

Silme testi, üç ardışık silme ve Firebase tekrar bildirimleri boyunca kalan satırların, parkurların, karakterlerin ve animasyonların korunmasını denetler.
