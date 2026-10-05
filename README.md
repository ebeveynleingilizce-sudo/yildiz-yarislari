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

## PC üzerinde otomatik test

Node.js ve kurulu Playwright tarayıcılarıyla repository kökünde:

```powershell
npm test
```

Bu komut mevcut Node testlerini koruyarak önce onları, ardından Playwright testlerini çalıştırır. İlk kurulum/başka PC için `npm ci` ve `npx playwright install chromium webkit` gerekir; bu PC'de kurulu tarayıcıları tekrar indirmek gerekmez.

- `npm run test:unit`: mevcut kaynak testleri.
- `npm run test:e2e`: bütün tarayıcı profilleri.
- `npm run test:mobile`: Android 360×800, Android 390×844, iPhone/WebKit 390×844.
- `npm run test:webkit`: iPhone ve 810×1080 tablet.
- `npm run test:desktop`: Chromium 1366×768.
- `npm run test:ui`: etkileşimli Playwright arayüzü.
- `npm run test:report`: HTML sonuç raporu.

Yerel sunucu otomatik başlar/kapanır ve yalnızca 127.0.0.1:4179 üzerinde çalışır. Bu port doluysa testler mevcut sunucuyu kullanmadan hata verir. Gerçek firebase.js uygulama akışı, dış SDK importları çıkarılarak tests/support/firebase-mock.js ile çalıştırılır; CSP dış bağlantıları engeller ve test fixture'ı Firebase/SDK isteği yapılmadığını kontrol eder. Taklit hesaplar yalnızca example.invalid adresleridir. Production verisi ve Auth kullanıcıları kullanılmaz.

Temel akışlar: öğrenci ekranı ve yatay taşma, öğretmen isim/XP/karakter/ekleme/kaldırma, yerel hesap ayrımı, yanlış öğrenci kodu, doğru/yanlış cevap, reddedilen XP kaydı ve tekrar deneme, üç ayrı manifest/simge. Mock, repository security rule ifadelerini yerel taklit veri üzerinde değerlendirir; gerçek Firebase Auth ve Rules Emulator doğrulaması, gerçek PWA kurulumu ve offline service-worker davranışı bu paketin kapsamı dışındadır; service worker deterministik E2E testlerde kapalıdır.

HTML raporu playwright-report/ altında; başarısız testlerde screenshot, trace ve video test-results/ altında bulunur. Öğrenci ve öğretmen görünüm fotoğrafları her profilde alınır. Bu çıktılar Git'e eklenmez.

## Öğrenci bağlantısı ve kaldırma regression testleri

Öğretmen panelinde öğrencinin “Bağlantıyı kopyala” düğmesi, mevcut paylaşım token’ı + öğrenci ID’si + kişisel giriş kodunu tek kod olarak kopyalar (`token:studentId:accessCode`). Yeni öğrenci bu kodla bağlanır. Paylaşım bağlantısı tek başına yarışa erişim sağlamaz. Anonim Auth oturumu Firebase tarafından korunur; yerelde yalnızca sınıf token’ı saklanır. Açılışta oturum ve mevcut erişim kuralları yeniden kontrol edilir. Öğrenci kaldırma/kod yenileme eski oturumu yetkisiz bırakır. Veri yolları korunmuştur; migration yoktur.

`tests/firebase.test.cjs` gerçek Firebase istemci akışını SDK taklidiyle çalıştırır. `tests/e2e/connection.spec.cjs` bağlantısız ilk açılışı, yanlış kodu, öğretmenler arası okuma/yazma izolasyonunu, yenilemeyi, canlı erişim iptalini, kod kopyalamayı ve reddedilen kaldırmanın geri alınmasını doğrular. Kaldırma testleri eski öğrencinin snapshot/DOM içine geri eklenmediğini, tek yazı yapıldığını ve kalan yarış kartının DOM kimliğinin korunduğunu kontrol eder.

Security rule değişiklikleri bu çalışma sırasında production’a deploy edilmez. Canlı güvenlik düzeltmesi için yeni kurallar ve uygulama birlikte yayınlanmalıdır. Eski linkler ve geçerli öğrenci oturumları korunur; yeni cihazlarda öğretmenin kopyaladığı birleşik kod gerekir. Kod bir erişim sırrıdır ve yalnızca ilgili öğrenciyle paylaşılmalıdır.

## Öğrenci silme regresyon testleri

Yerel taklit Firebase verisiyle çalışır; gerçek hesaplara veya üretim verisine erişmez.

```sh
npm ci
npx playwright install chromium webkit
npm test
```

Silme testi, üç ardışık silme ve Firebase tekrar bildirimleri boyunca kalan satırların, parkurların, karakterlerin ve animasyonların korunmasını denetler.

## Sınıf yönetimi

Öğretmen panelindeki **+ Sınıf Oluştur**, sınıf seçimi, yeniden adlandırma ve **Sınıfı değiştir** işlemleri kullanılır. Dolu sınıf silinirken hedef sınıf seçilmesi zorunludur; son sınıf silinemez. Taşınan öğrenci yeni sınıfının koduyla giriş yapar.

Veri modeli: `teacherData/{teacherId}/classes/{classId}` metadata; `classData/{classId}` öğrenciler, görevler, giriş kodları, yıldız geçmişi ve sezonlar. Öğrenci kayıtları `teacherId` ve `classId` taşır. Her sınıfın ayrı paylaşım token'ı, `sharedRosters/{token}` ve `studentCredentials/{token}` kaydı vardır; token öğretmeni ve sınıfı çözer. Öğrenci yalnızca geçerli oturum/kodunun sınıfını okuyabilir.

Eski hesaplar ilk öğretmen girişinde Firebase transaction ile **Varsayılan Sınıf**a taşınır. Öğrenci kimlikleri, XP, kodlar ve eski paylaşım token'ı korunur; legacy alanları ve geçiş yedekleri saklanır. Soru geçmişi eski token altında kalır; öğrenci taşınırken hedef token'a kopyalanır. Silinen sınıfın sezon/geçmiş verisi `classArchives` altında korunur.

Testler üretim hesabı kullanmaz: `tunc@test.com` örneği yalnızca yerel SDK taklidindedir. `npm test` birim testleri ve beş Playwright profilini çalıştırır. Güvenlik kuralları sayfayla birlikte yayımlanmalıdır: `firebase deploy --only database --project yildizyarislari`.
