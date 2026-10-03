# Overnight Quality / Stability Pass
Tarih: 4 Ekim 2026  
Depo: https://github.com/ebeveynleingilizce-sudo/yildiz-yarislari

## Fixed
- Soru bankası doğru cevabı artık Firebase kaydı tamamlanınca XP olarak onaylıyor. Yazma reddedilirse yerel puan geri alınıyor ve öğrenci yeniden deneyebiliyor.
- Sonuç geçmişi kaydedilemezse zaten onaylanmış XP korunuyor; geçmiş kaydının başarısız olduğu sonuç ekranında belirtiliyor.
- Görev panosu kayıt sırasında butonu kilitliyor; Firebase yanıtından sonra başarı/hata gösteriyor, başarısızlıkta eski listeye dönüyor.
- Firebase yazma hataları artık gerçek kodu UI’da, path/Auth UID/anonim durum/proje bağlamını konsolda gösteriyor.
- Öğrenci giriş formu Firebase modülü yüklenene kadar sınırlı süre bekliyor; yüklenme hatası ile yetki hatası ayrılıyor.
- Hizmet çalışanı cache’i v27’ye çıkarıldı; soru bankası asset URL’siyle hizalandı.
- Yıldız ve sezon geçmişi yazmaları da path loglamasına ve başarısızlıkta bellek geri alımına bağlandı.

## Root causes
- “Öğrenci bağlantısı hazırlanıyor” uyarısı, form gönderildiğinde Firebase modülünün henüz `raceCloud.authorizeStudent` sağlamamasından çıkıyordu. Bu tek başına rules hatası değildi. Canlı öğrenci ekranında anonim Auth ile 8 kişilik paylaşılan roster yüklendi; ilk auth/roster okumasının çalıştığı görüldü.
- “Firebase'e kaydedilemedi” eski genel catch mesajı gerçek nedeni gizliyordu. Bu turda geçmiş kayıt hatası yeniden üretilemedi; gerçek geçmiş kod/path kesin bilinmiyor. Yeni hatada kod UI’da, path ve Auth bağlamı konsolda görülecek.
- Soru XP’si Firebase yazma yanıtı beklenmeden onaylanıyordu; şimdi onay write sonucuna bağlı.

## Tests added
- Öğrenci Firebase yazması reddedilince XP/yerel ilerleme rollback testi.
- Firebase isteği beklerken başarı bildirimi çıkmadığı testi.
- Firebase hata yolu/Auth bağlamı, görev kaydı yanıtı ve kök rules erişimlerinin kapalı kaldığı testi.

## Verification
- GitHub Actions `node --test tests/game.test.cjs`: **36/36 geçti**.
- Site hazırlama ve GitHub Pages deploy adımları **başarılı**: https://github.com/ebeveynleingilizce-sudo/yildiz-yarislari/actions/runs/37156027160
- Canlı öğrenci ekranında 8 öğrencilik roster yüklendi. Öğretmen test modu açıldı; production XP/roster verisi değiştirilmedi.
- Depoda npm build/lint/TypeScript komutu yok; CI Node testleri ve Pages deploy kullanıyor.
- Responsive breakpoint/reduced-motion/PWA kodu gözden geçirildi. 1920×1080, 1366×768, 1024×768, 390×844 ve 844×390’in her birinde görsel test tamamlanmadı.
- Gerçek tarayıcı konsolu CI’da test edilmiyor. PWA’nın gerçek cihaz/offline güncellemesi de doğrulanmadı.

## Firebase
- Uygulama Firestore değil, **Realtime Database** kullanıyor.
- Yol yapısı: `teacherData/{uid}`, `testTeacherData/{uid}`, `sharedRosters/{token}`, `studentCredentials/{token}`, `studentSessions/{token}/{anonymousUid}`, `studentQuestionData/{token}/{studentId}`, ayrıca `class-race/defaultRosterToken`.
- Rules kök read/write kapalı; teacher UID ve öğrencinin anonymous UID/kod/ID’siyle sınırlı. Rules değiştirilmedi/gevşetilmedi.
- Firebase Console’daki Email/Password, Google, Anonymous ve GitHub Pages yetkili alanı daha önce kontrol edildi; manuel Console işlemi gerekmiyor.
- Gerçek öğrenci kodu kullanılmadı. Production doğru/yanlış kod uçtan uca testi, öğretmen production write→refresh→readback ve iki gerçek öğretmen hesabıyla izolasyon testi yapılmadı. Gerçek Firebase hata kodu bu turda yeniden üretilemedi.

## PWA
- Öğrenci/öğretmen/test manifest ayrımı korunuyor. Cache v27 değişikliği CI’dan geçti.
- Gerçek cihaz kurulum/offline davranışı test edilmedi.

## Responsive
- CSS breakpoint’leri, öğrenci/öğretmen görünümleri ve reduced-motion incelendi. Beş hedef viewport’ta görsel overflow testi yapılmadı.

## Remaining issues
- Önceki Firebase hatasının gerçek kod/path’i bulunamadı; yeni yapı bir sonraki oluşumda bunu yakalayacak.
- Aynı öğrencinin birden fazla cihazda eşzamanlı soru çözmesi, tek nesne yazımında son yazanın diğer cihaz güncellemesini ezmesine yol açabilir. Transaction/data-model değişikliği gerektirdiğinden bu turda yapılmadı.
- Canlı doğru/yanlış öğrenci kodu, teacher production readback, iki hesap izolasyonu ve hedef boyut görsel testleri açık kaldı.

## Needs owner decision
- Şu an karar bekleyen konu yok.

## Do not forget
- Firebase Console’da değişiklik, DB sıfırlama veya kullanıcı işlemi gerekmedi.
- GitHub Actions ve Pages deployment başarılı.
