const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { Pool } = require("pg");
const { tmpdir } = require("os");
const { v4: uuidv4 } = require("uuid");

// ÖNEMLİ: Lambda Layer'dan gelen FFMPEG yolu
const ffmpegPath = "/opt/bin/ffmpeg";
try {
    if (fs.existsSync(ffmpegPath)) {
        // --- YENİ EKLENEN KISIM BAŞLANGICI ---
        try {
            // Windows zip sorununu çözmek için dosyaya çalıştırma izni veriyoruz
            fs.chmodSync(ffmpegPath, '755'); 
        } catch (e) {
            console.log("İzin verme hatası (önemsiz olabilir):", e.message);
        }
        // --- YENİ EKLENEN KISIM BİTİŞİ ---

        ffmpeg.setFfmpegPath(ffmpegPath);
        console.log("FFmpeg binary bulundu:", ffmpegPath);
    } else {
        console.warn("UYARI: FFmpeg binary /opt/bin/ffmpeg yolunda bulunamadı! Lambda Layer ekledin mi?");
        // Yolu set etmiyoruz, belki PATH'dedir diye umut ediyoruz
    }
} catch (e) {
    console.error("FFmpeg path kontrol hatası:", e);
}

const s3Client = new S3Client();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Yardımcı: S3 Stream'i Buffer'a çevir
const streamToBuffer = async (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
};

exports.handler = async () => {
    console.log("Video Lambda fonksiyonu başlatıldı");
    
    const client = await pool.connect();
    
    try {
        // Zaman penceresi: son 60 dakika
        const windowStart = new Date(Date.now() - 60 * 60 * 1000); // now - 60 min
        const windowEnd = new Date(); // now

        console.log(`Zaman penceresi: ${windowStart.toISOString()} - ${windowEnd.toISOString()}`);

        // 1. İşlenmiş (resized) fotoğrafları çek - processed/ klasöründeki URL'ler
        // is_processed=true: picture-lambda tarafından resize edilmiş
        // in_video=false: henüz bir videoya dahil edilmemiş
        // created_at: son 60 dakika içinde
        const query = `
            SELECT id, image_url, city_id, created_at
            FROM photos
            WHERE image_url LIKE '%/processed/%'
              AND is_processed = true
              AND is_failed = false
              AND in_video = false
              AND created_at >= $1
              AND created_at < $2
            ORDER BY city_id, created_at DESC
        `;
        const { rows: allPhotos } = await client.query(query, [windowStart, windowEnd]);
        
        if (allPhotos.length === 0) {
            console.log("İşlenecek fotoğraf bulunamadı.");
            return { statusCode: 200, body: JSON.stringify({ message: "No unprocessed photos found" }) };
        }
        
        // Fotoğrafları şehirlere göre grupla
        const photosByCity = {};
        allPhotos.forEach(photo => {
            if (!photosByCity[photo.city_id]) {
                photosByCity[photo.city_id] = [];
            }
            photosByCity[photo.city_id].push(photo);
        });
        
        console.log(`${Object.keys(photosByCity).length} farklı şehir için işlem başlıyor`);
        
        for (const cityId in photosByCity) {
            // Spec: son 5 işlenmiş fotoğrafı al
            const cityPhotos = photosByCity[cityId].slice(0, 5); 
            console.log(`Şehir ID ${cityId} için ${cityPhotos.length} fotoğraf işleniyor...`);
            
            const imagePaths = [];
            const successfulPhotos = [];
            const failedPhotos = [];
            let earliestTimestamp = null;
            let latestTimestamp = null;

            // 2. Fotoğrafları İndir
            for (const photo of cityPhotos) {
                try {
                    // URL'den S3 key'i çıkar (processed/filename.jpg formatında)
                    const urlParts = photo.image_url.split('.amazonaws.com/');
                    const s3Key = urlParts.length > 1 ? decodeURIComponent(urlParts[1].replace(/\+/g, ' ')) : null;

                    if (!s3Key || !s3Key.startsWith('processed/')) {
                        console.log(`Geçersiz processed URL, atlanıyor: ${photo.image_url}`);
                        continue;
                    }
                    
                    const localPath = path.join(tmpdir(), `img_${photo.id}.jpg`);
                    
                    console.log(`İndiriliyor: ${s3Key}`);
                    
                    const getCommand = new GetObjectCommand({
                        Bucket: process.env.S3_BUCKET_NAME,
                        Key: s3Key
                    });
                    
                    const response = await s3Client.send(getCommand);
                    const fileBuffer = await streamToBuffer(response.Body);
                    
                    fs.writeFileSync(localPath, fileBuffer);
                    
                    imagePaths.push(localPath);
                    successfulPhotos.push(photo.id);
                    
                    const photoTimestamp = new Date(photo.created_at);
                    if (!earliestTimestamp || photoTimestamp < earliestTimestamp) earliestTimestamp = photoTimestamp;
                    if (!latestTimestamp || photoTimestamp > latestTimestamp) latestTimestamp = photoTimestamp;
                    
                } catch (error) {
                    console.error(`Fotoğraf indirme hatası ID ${photo.id}:`, error.message);
                    failedPhotos.push(photo.id);
                }
            }
            
            // Hatalıları işaretle
            if (failedPhotos.length > 0) {
                await client.query(`UPDATE photos SET is_failed = true WHERE id = ANY($1)`, [failedPhotos]);
            }
            
            if (successfulPhotos.length < 2) {
                console.log("Video yapmak için yeterli fotoğraf yok (En az 2 gerekli).");
                continue;
            }

            // IDEMPOTENCY CHECK: Check if a video already exists for this city and time window
            const existingVideoCheck = await client.query(
                `SELECT id FROM videos
                 WHERE city_id = $1
                 AND time_range_start <= $2
                 AND time_range_end >= $3
                 LIMIT 1`,
                [cityId, latestTimestamp, earliestTimestamp]
            );

            if (existingVideoCheck.rowCount > 0) {
                console.log(`IDEMPOTENCY: Video already exists for city ${cityId} in time range ${earliestTimestamp} - ${latestTimestamp}. Skipping.`);
                // Mark photos as in_video to avoid re-selection
                await client.query(`UPDATE photos SET in_video = true WHERE id = ANY($1)`, [successfulPhotos]);
                continue;
            }

            // 3. Videoyu Oluştur
            const videoFileName = `video_${cityId}_${uuidv4()}.mp4`;
            const videoPath = path.join(tmpdir(), videoFileName);
            
            // FFmpeg list dosyası hazırla
            const listFilePath = path.join(tmpdir(), `files_${cityId}.txt`);
            // Spec: 15 saniyelik video, 5 fotoğraf = 3 saniye/fotoğraf
            const listContent = imagePaths.map(p => `file '${p}'\nduration 3`).join("\n"); 
            // Son dosya tekrarı (ffmpeg bug'ını önlemek için)
            fs.writeFileSync(listFilePath, listContent + `\nfile '${imagePaths[imagePaths.length-1]}'\n`);
            
            console.log(`Video oluşturuluyor: ${videoPath}`);
            
            try {
                await new Promise((resolve, reject) => {
                    ffmpeg()
                        .input(listFilePath)
                        .inputOptions(['-f', 'concat', '-safe', '0'])
                        .outputOptions([
                            '-c:v', 'libx264',
                            '-r', '30',
                            '-pix_fmt', 'yuv420p',
                            // İŞTE SİHİRLİ SATIR BURASI: Tüm resimleri 1280x720 boyutuna zorla ve ortala
                            '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2'
                        ])
                        .save(videoPath)
                        .on('end', resolve)
                        .on('error', reject);
                });
                
                // 4. Videoyu Yükle (v3)
                const videoS3Key = `videos/${videoFileName}`;
                const videoBuffer = fs.readFileSync(videoPath);
                
                await s3Client.send(new PutObjectCommand({
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: videoS3Key,
                    Body: videoBuffer,
                    ContentType: "video/mp4"
                }));
                
                const region = process.env.AWS_REGION || "eu-central-1";
                const videoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${videoS3Key}`;
                
                // 5. Kaydet ve Güncelle
                await client.query(
                    `INSERT INTO videos (city_id, time_range_start, time_range_end, video_url) VALUES ($1, $2, $3, $4)`,
                    [cityId, earliestTimestamp, latestTimestamp, videoUrl]
                );
                
                // Fotoğrafları in_video=true yap (artık videoda kullanıldılar)
                await client.query(`UPDATE photos SET in_video = true WHERE id = ANY($1)`, [successfulPhotos]);
                
                console.log(`Video başarıyla oluşturuldu: ${videoUrl}`);
                
            } catch (err) {
                console.error("Video oluşturma hatası:", err);
                // Video başarısızsa fotoğrafları failed yapma, belki sonra düzelir
            }
        }
        
        return { statusCode: 200, body: JSON.stringify({ message: "Completed" }) };

    } catch (error) {
        console.error("Genel Hata:", error);
        return { statusCode: 500, error: error.message };
    } finally {
        client.release();
    }
};