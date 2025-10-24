import * as ort from 'onnxruntime-web';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Подключаем вебку
navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    video.srcObject = stream;
    video.play();
});

// Загружаем модель
const session = await ort.InferenceSession.create('modnet.onnx', { executionProviders: ['webgpu','wasm'] });

video.addEventListener('play', () => {
    const loop = async () => {
        if (video.paused || video.ended) return;

        // Получаем кадр с видео
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Преобразуем в тензор (1,3,H,W) и нормализуем
        const data = new Float32Array(512 * 512 * 3);
        for (let i = 0; i < 512*512; i++) {
            data[i] = imageData.data[i*4] / 255.0;       // R
            data[i + 512*512] = imageData.data[i*4+1]/255.0; // G
            data[i + 2*512*512] = imageData.data[i*4+2]/255.0; // B
        }
        const tensor = new ort.Tensor('float32', data, [1,3,512,512]);

        // Инференс
        const feeds = {};
        feeds[session.inputNames[0]] = tensor;
        const results = await session.run(feeds);
        const matte = results[session.outputNames[0]]; // маска

        // TODO: наложение маски на canvas

        requestAnimationFrame(loop);
    };
    loop();
});
