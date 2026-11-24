# MegaNature v1 raporu

## Teslim

Kalsoy, Kunoy ve Eysturoy’un kuzeydoğu dağları, tek bir Three.js haritasında gezilebiliyor. Başlangıç noktası Kallur Feneri’nin yaklaşık 92 m güneydoğusunda, denizden yaklaşık 219 m yüksekte. Arazi dört ayrıntı seviyesinde çiziliyor. Eğim, kaya ve çimen geçişini belirliyor. Deniz yüzeyi, kıyı köpüğü ve iki alçak sis katmanı hareket ediyor. Sahnede instanced çimen ve otlayıp gezinen 36 beyaz ve siyah koyun var. Kallur’un beyaz-kırmızı modeli OpenStreetMap koordinatında duruyor.

Türkçe arayüz yürüyüş, koşu, fareyle bakış, uçuş, fotoğraf modu ve dokunmatik joystick içeriyor. Rakım ve koordinatlar kamera konumuyla güncelleniyor. esbuild’in ürettiği statik `dist/` yerel sunucuda 4174 portundan açılıyor.

## Bölge ve yükseklik

- WGS 84 sınırları batı **−7,0215**, güney **62,236**, doğu **−6,595916939652**, kuzey **62,4336**. Yaklaşık **21,97 × 21,97 km**. Kallur, iki adanın güney kıyılarını da kapsayan karenin merkezinin yaklaşık 3,94 km kuzeyinde. [Bölge tanımı](data/region.json).
- Eysturoy’daki Slættaratindur’u kapsamak için batı uç −7° sınırını geçiyor. İşleme `N62 W007` ve `N62 W008` karolarını tek metrik ızgarada birleştiriyor. Çıktı **769 × 769** Uint16 desimetre örneği, **28,610 m/örnek**, **1.182.722 bayt** ve **0–873,5 m**. Dikey ölçek **1:1**. [İşlenmiş veri meta bilgisi](public/maps/faroe-north/meta.json).
- Maksimum örnek Slættaratindur GPS noktasının 1 m yakınında ve yayımlanan 880 m değerin 6,5 m altında. Fener noktasındaki model zemini **184,7 m**, yayımlanan **240 m** ise ışığın odak kotu. Komşu zirvelerin karşılaştırması README’de. [DEM doğrulaması](README.md#doğrulama).

## Çalıştırılan doğrulamalar

- Node.js **24.19.0**, npm **11.17.0**. `npm ci --no-audit --no-fund` başarılı, 15 paket kuruldu. npm, esbuild’in isteğe bağlı postinstall betiği için izin uyarısı verdi. Esbuild’in Windows ikili paketiyle `npm run build` başarılı oldu ve `dist/main.js` (560,0 kB) ile `dist/style.css` (6,8 kB) üretildi.
- `node server.mjs` ile 4174 portundaki önizleme açıldı. Ana sayfa **HTTP 200**, `height.bin` için HEAD yanıtı **1.182.722 bayt** döndürdü.
- `npm run fetch:dem -- --force` iki karoyu AWS’den yeniden indirdi. `npm run build:heightmap` çıktısı ilk üretilen dosyayla ve statik paketteki kopyayla bayt düzeyinde eşleşti. SHA-256 değeri `56FD966EC795BACE09F7B17AD26D2B07B758CB7C75168CF065EDA28502FF3075`.
- `npm test` Microsoft Edge **158.0.4370.33** headless ve NVIDIA GeForce RTX 4060 ile başarılı oldu. Son çalıştırmadan seçili satırlar aşağıda.

```text
DEM Slættaratindur · nokta 873.2 m · 60 m çevre 873.2 m · referans 880 m
DEM Kúvingafjall · nokta 769.3 m · 150 m çevre 812.0 m · referans 830 m
DEM Nestindar · nokta 730.8 m · 60 m çevre 732.3 m · referans 788 m
DEM Sandfelli (Gjógv) · nokta 741.7 m · 60 m çevre 743.2 m · referans 752 m
DEM Kallur · zemin 184.7 m · ışık odak kotu 240 m · fark 55.3 m
Canvas · 19534/19580 aydınlık piksel, 376 renk grubu · LOD adımları 1, 2, 4, 8 · 36 koyun
Açılışta 144.0 fps (2,2 sn) · render ölçeği 1.00
Pointer lock, fotoğraf modu ve kaynak atfı geçti.
W · 4.01 m hareket · kamera zeminden 1.75 m yukarıda
F / E / Shift · 1750.4 m rakım, 5150.3 m yatay uçuş · render ölçeği 1.00
Q ile alçalma ve F ile yürüyüşe dönüş geçti.
Dokunmatik joystick, uçuş düğmesi ve fotoğraf modu geçti (Edge dokunmatik emülasyonu).
0 konsol/sayfa hatası · 0 harici istek · tests/shots/01-kallur.png ve tests/shots/02-ucus.png
```

- Ayrı bir Edge çalıştırmasında SwiftShader ile çözünürlük adaptasyonu denendi. Ölçek **1,00 → 0,85** ve WebGL çizim tamponu **1120 × 700 → 952 × 595** oldu.
- İki kaydedilmiş kare gözle incelendi. Açılışta yeşil yamaç, beyaz ve siyah koyunlar, solda kaya uçurumu, deniz, uzak adalar ve suya yakın sis görünüyor. Uçuş karesinde Kalsoy ortada, Kunoy solda, Eysturoy sağda. Kıyı köpüğü ve adalar arasındaki alçak sis seçiliyor. [Açılış karesi](tests/shots/01-kallur.png), [uçuş karesi](tests/shots/02-ucus.png).

## Bilinen sınırlar

- GLO-30 dar sırtları ve uçurumları yumuşatıyor. Nestindar’ın yakın çevresinde DEM ile yayımlanan zirve arasında yaklaşık **56 m** fark var. Kallur’da ışık kotuyla DEM zemini arasındaki **55,3 m** farkın yalnız bir kısmı binanın yüksekliğinden gelir. Fener modeli DEM yüzeyine uyarlanmış bir temel üzerinde duruyor ve açılış kamerasının baktığı yönün dışında kalıyor.
- **144,0 fps** ölçümü RTX 4060’ta, 1440 × 900 açılış görünümündeki 2,2 saniyelik headless ölçümdür. Orta seviye dizüstü için 60 fps hedefi fiziksel bir cihazda ayrıca ölçülmeli. Dokunmatik doğrulama Edge emülasyonunda yapıldı.

## Sonraki adım

Kallur sırtı ve Nestindar için açık lisanslı, daha yüksek çözünürlüklü bir yerel yükseklik kaynağını GLO-30 ile karşılaştırın. İlk ölçütler, fenerin zemin kotu ve yerel zirve farkı olabilir.
