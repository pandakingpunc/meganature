# MegaNature v1 — görev brifi (GPT-6.2 Sol için)

MegaNature, gerçek arazi verisinden üretilmiş, tarayıcıda içinde yürünebilen 3D doğa haritaları koleksiyonu. Marka: "Mega". Bu repo yalnız **v1: tek bir harita** içindir. Oyun, harita seçme menüsü, ikinci bölge YOK. Kapsamı genişletme.

## v1 haritası: Faroe Adaları kuzeyi (Kalsoy – Kunoy – Eysturoy)

Referans his: dik yeşil yamaçlar, denize dik inen uçurumlar, karşıda düz tepeli adalar, alçak bulut/sis denizi, yamaçta otlayan koyunlar, gün batımı ışığı.

- Bölge: Kalsoy adasının kuzey ucu (Kallur deniz feneri civarı) merkezli, yaklaşık 18–22 km kare bir kutu. İçinde Kalsoy, Kunoy ve Eysturoy'un kuzeydoğu dağları olsun. Koordinatları OSM/Wikipedia'dan doğrula; seçtiğin bbox'ı `data/region.json` ve README'ye yaz.
- Kutu tamamen `N62 W007` karosunun (lat 62–63, lon −7…−6) içinde kalsın; kalamıyorsa ikinci karoyu da indir ve birleştir.

## Arazi verisi (zorunlu: gerçek veri, uydurma dağ yok)

- Kaynak: **Copernicus DEM GLO-30**, AWS açık veri:
  `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N62_00_W007_00_DEM/Copernicus_DSM_COG_10_N62_00_W007_00_DEM.tif`
- `scripts/fetch-dem.mjs`: karoyu `data/raw/` altına indirir (git'e girmez, `.gitignore`).
- `scripts/build-heightmap.mjs`: `geotiff` npm paketiyle okur, bbox'ı keser, enlemdeki boylam ölçeğini (cos φ) hesaba katarak metrik kare ızgaraya yeniden örnekler (ör. 1024×1024 veya doğal çözünürlüğe yakın), sonucu `public/maps/faroe-north/height.bin` (Uint16, desimetre veya uygun ölçek) + `meta.json` (boyut, metre/piksel, min/max yükseklik, bbox, kaynak, lisans) olarak yazar. Bu işlenmiş dosya repoya girer (birkaç MB'ı geçmesin).
- Deniz pikselleri (≤0 m) deniz kabul edilir. Dikey abartı yok (gerçek ölçek 1:1); varsa `meta.json`'da açıkça belirt.
- Atıf metnini README ve uygulamadaki küçük "Kaynaklar" bölümüne koy: Copernicus DEM GLO-30, © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA.

## Uygulama

- Stack: Three.js + esbuild (opend3/swiss alp projesindeki düzene benzer; oraya bakabilirsin ama oraya dokunma). Çıktı `dist/` — Vercel'de statik site olarak açılacak (`npm run build` → `dist`). Gerekirse minimal `vercel.json`.
- Arazi: heightmap'ten mesh. Yakında sık, uzakta seyrek (en az 2 LOD halkası veya chunk). 30 m çözünürlük uçurumları yumuşatır; shader'da eğime göre kaya/çimen karışımı ve ince ayrıntı gürültüsü ekle ki uçurumlar kaya gibi görünsün. Görsel ayrıntı ekleyebilirsin ama arazinin kendisi gerçek veriden gelsin.
- Deniz: 0 m'de animasyonlu su, kıyıda köpük çizgisi.
- Gökyüzü + atmosfer: gün batımı ışığı, mesafe sisi, alçak bulut/sis katmanı (adaların arasında süzülen).
- Bitki örtüsü: yamaçlarda instanced çimen öbekleri (performanslı).
- Koyunlar: 20–60 basit low-poly koyun (beyaz ve siyah), yamaçlarda yavaşça otlayıp gezinsin, çok dik yere çıkmasın.
- Kallur deniz feneri: gerçek konumuna küçük beyaz-kırmızı bir fener modeli (basit geometri).
- Kontroller: WASD/ok yürüyüş (araziyi takip eden kamera, dik yamaca tırmanamaz), fare ile bakış (pointer lock), Shift koşu, F uçuş modu (Q/E alçal/yüksel), P fotoğraf modu (UI gizle). Dokunmatikte basit sanal joystick.
- Açılışta Kallur feneri yakınından, koyunlar ve karşı adalar görünecek güzel bir başlangıç noktası.
- Arayüz Türkçe, minimal: sol altta "MegaNature · Faroe Adaları — Kalsoy", tuş ipuçları, gerçek rakım (m) ve koordinat (enlem/boylam) göstergesi.
- Performans: orta seviye dizüstünde 60 fps hedef; GPU yavaşsa çözünürlüğü düşüren basit uyarlanabilir kalite.
- Harici CDN yok, API anahtarı yok, hesap yok. Ses opsiyonel (rüzgâr/deniz, WebAudio ile üretilmiş, kullanıcı etkileşiminden sonra).

## Repo düzeni

```
package.json  build.mjs  server.mjs (yerel önizleme, port 4174)
src/ (main.js, terrain.js, water.js, sky.js, sheep.js, ui, index.html, style.css)
scripts/ (fetch-dem.mjs, build-heightmap.mjs)
public/maps/faroe-north/ (height.bin, meta.json)
tests/validate.mjs
README.md (Türkçe)  LICENSE (MIT, Copyright (c) 2026 Mustafa Karatüm)  THIRD_PARTY_LICENSES.txt
.gitignore (node_modules, data/raw, dist?)
```

## Doğrulama (bitti demeden önce hepsini çalıştır)

1. `npm ci` / `npm install`, `npm run build` hatasız.
2. `tests/validate.mjs`: Playwright (Microsoft Edge kanalı, headless) ile `dist`'i aç; konsol hatası yok; canvas çiziyor (boş/siyah değil, piksel örneği kontrolü); W tuşuyla yürüyünce konum değişiyor ve kamera arazinin üstünde kalıyor; F ile uçuş açılıyor. Başlangıç bakışından ve uçuş modunda yukarıdan iki ekran görüntüsünü `tests/shots/` altına kaydet.
3. Heightmap sağlaması: `meta.json`'daki max yükseklik bölgenin bilinen zirveleriyle tutarlı mı (Kalsoy/Kunoy/Eysturoy zirveleri ~700–880 m)? Kallur feneri koordinatında rakım mantıklı mı? Sonucu README'nin "Doğrulama" bölümüne yaz.
4. Ekran görüntülerine kendin bak; deniz, uçurum, yeşil yamaç, koyun ve sis görünüyor mu?

## Kurallar

- Yalnız `C:\Users\Superuser\Desktop\opend3\meganature` içinde çalış. Başka klasöre yazma.
- `git commit` serbest (anlamlı adımlarda küçük commit'ler). **`git push` yapma, GitHub reposu açma, Vercel'e deploy etme.**
- Bitince `REPORT.md` yaz: ne yapıldı, seçilen bbox, heightmap boyutu, test sonuçları (gerçek çıktı), bilinen sınırlar, sonraki adım önerisi. Uydurma sonuç yazma; çalışmayan bir şey varsa açıkça söyle.
