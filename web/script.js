// === Класс сотрудника ===
class Employee {
    constructor() {
        this.employee = {
            full_name: '',
            position: '',
            company: '',
            department: '',
            office_location: '',
            contact: { email: '', telegram: '' },
            branding: { logo_url: '', corporate_colors: { primary: '#0052CC', secondary: '#00B8D9' }, slogan: '' },
            privacy_level: 'medium'
        };
    }
    setFullName(v) { this.employee.full_name = v; }
    setPosition(v) { this.employee.position = v; }
    setCompany(v) { this.employee.company = v; }
    setDepartment(v) { this.employee.department = v; }
    setOfficeLocation(v) { this.employee.office_location = v; }
    setEmail(v) { this.employee.contact.email = v; }
    setTelegram(v) { this.employee.contact.telegram = v; }
    setLogoUrl(v) { this.employee.branding.logo_url = v; }
    setSlogan(v) { this.employee.branding.slogan = v; }
    setPrivacy(v) { this.employee.privacy_level = v; }

    save_to_json() {
        const data = JSON.stringify({ employee: this.employee }, null, 2);
        localStorage.setItem('employee_data', data);
        
        const showDataBtn = document.getElementById('showDataBtn');
        const showDataColorBtn = document.getElementById('showDataColorBtn');
        showDataBtn.disabled = false;
        showDataBtn.classList.add('enabled');
        showDataColorBtn.disabled = false;
        showDataColorBtn.classList.add('enabled');
        
        alert('Данные сохранены! Теперь вы можете отобразить их на фоне.');
    }
}

// === Основной UI ===
class DigitalDressCodeUI {
    constructor() {
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('output');
        this.ctx = this.canvas.getContext('2d');
        
        // MediaPipe элементы
        this.selfieSegmentation = null;
        this.maskCanvas = document.createElement('canvas');
        this.maskCtx = this.maskCanvas.getContext('2d');
        this.isSegmentationActive = false;
        this.camera = null;
        
        this.employee = new Employee();
        
        // Для усреднения FPS и GPU
        this.fpsValues = [];
        this.gpuValues = [];
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        this.gpuLoad = 0;
        
        // Флаг для отображения данных сотрудника
        this.showEmployeeData = false;
        
        // Текущий выбранный фон
        this.currentBackground = null;
        this.backgroundImage = new Image();
        
        // Текущий выбранный цвет
        this.selectedColor = null;

        this.fpsDisplay = document.getElementById('fpsDisplay');
        this.gpuDisplay = document.getElementById('gpuDisplay');

        this.initCamera();
        this.initMediaPipe();

        // Инициализация левой панели фонов
        this.initBackgroundPanel();
        
        // Инициализация панели цвета
        this.initColorPanel();
        
        // Панель сотрудника
        const panel = document.getElementById('employeePanel');
        const btn = document.getElementById('employeeBtn');
        const back = document.getElementById('backBtn');

        btn.addEventListener('click', () => panel.classList.add('open'));
        back.addEventListener('click', () => panel.classList.remove('open'));

        document.getElementById('saveEmployee').addEventListener('click', () => {
            this.collectEmployeeData();
            this.employee.save_to_json();
        });

        // Кнопки отображения данных
        document.getElementById('showDataBtn').addEventListener('click', () => {
            if (!this.employee.employee.full_name || !this.employee.employee.position) {
                document.getElementById('noDataNotification').style.display = 'block';
                return;
            }
            this.showEmployeeData = true;
            this.applyBackground();
        });

        document.getElementById('showDataColorBtn').addEventListener('click', () => {
            if (!this.employee.employee.full_name || !this.employee.employee.position) {
                document.getElementById('noDataNotification').style.display = 'block';
                return;
            }
            this.showEmployeeData = true;
            this.applyColorBackground();
        });

        // Закрытие уведомления
        document.getElementById('closeNotification').addEventListener('click', () => {
            document.getElementById('noDataNotification').style.display = 'none';
        });

        // Переключение панелей
        document.getElementById('panelToggle').addEventListener('click', () => {
            this.togglePanels();
        });

        // Загружаем сохранённые данные при инициализации
        this.loadEmployeeData();
        
        // Устанавливаем начальный фон
        const firstBackground = document.querySelector('.background-item').getAttribute('data-background');
        this.currentBackground = firstBackground;
        
        // Запускаем основной цикл
        this.loop();
    }

    async initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 }, 
                    height: { ideal: 480 }, 
                    frameRate: { ideal: 30 } 
                } 
            });
            this.video.srcObject = stream;
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => resolve();
            });
            
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.maskCanvas.width = this.video.videoWidth;
            this.maskCanvas.height = this.video.videoHeight;
            
        } catch (error) {
            console.error('Ошибка инициализации камеры:', error);
            alert('Не удалось получить доступ к камере. Проверьте разрешения.');
        }
    }

    async initMediaPipe() {
        try {
            if (typeof SelfieSegmentation === 'undefined') {
                console.log('MediaPipe не загружен, ожидаем загрузки...');
                setTimeout(() => this.initMediaPipe(), 100);
                return;
            }
            
            this.selfieSegmentation = new SelfieSegmentation({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
            });
            
            this.selfieSegmentation.setOptions({
                modelSelection: 1,
                selfieMode: true
            });
            
            this.selfieSegmentation.onResults((results) => {
                this.onSegmentationResults(results);
            });
            
            console.log('MediaPipe инициализирован');
            
            // Запускаем камеру MediaPipe
            this.startMediaPipeCamera();
            
        } catch (error) {
            console.error('Ошибка инициализации MediaPipe:', error);
        }
    }

    async startMediaPipeCamera() {
        if (!this.selfieSegmentation) return;
        
        this.camera = new Camera(this.video, {
            onFrame: async () => {
                if (this.selfieSegmentation) {
                    await this.selfieSegmentation.send({ image: this.video });
                }
            },
            width: this.video.videoWidth,
            height: this.video.videoHeight
        });
        await this.camera.start();
    }

    onSegmentationResults(results) {
        if (!results?.segmentationMask) return;

        const { width, height } = this.maskCanvas;
        
        // Очищаем mask canvas
        this.maskCtx.clearRect(0, 0, width, height);
        
        // Рисуем маску сегментации
        this.maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);
        
        // Применяем размытие для сглаживания краев
        this.maskCtx.globalCompositeOperation = 'copy';
        this.maskCtx.filter = 'blur(8px)';
        this.maskCtx.drawImage(this.maskCanvas, 0, 0, width, height);
        this.maskCtx.filter = 'none';
        this.maskCtx.globalCompositeOperation = 'source-over';
    }

    initBackgroundPanel() {
        const backgroundItems = document.querySelectorAll('.background-item');
        backgroundItems.forEach(item => {
            item.addEventListener('click', () => {
                const backgroundPath = item.getAttribute('data-background');
                this.selectBackground(backgroundPath);
                
                backgroundItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                this.selectedColor = null;
                document.querySelectorAll('.color-item').forEach(color => color.classList.remove('active'));
                
                this.previewBackground(backgroundPath);
            });
        });

        document.getElementById('applyBtn').addEventListener('click', () => {
            this.showEmployeeData = false;
            this.isSegmentationActive = true;
            this.applyBackground();
            document.getElementById('previewContainer').style.display = 'none';
        });
        
        document.getElementById('loadCustomBackground').addEventListener('click', () => {
            const customUrl = document.getElementById('customBackgroundInput').value;
            if (customUrl) {
                this.selectBackground(customUrl);
                backgroundItems.forEach(i => i.classList.remove('active'));
                
                this.selectedColor = null;
                document.querySelectorAll('.color-item').forEach(color => color.classList.remove('active'));
                
                this.previewBackground(customUrl);
            } else {
                alert('Пожалуйста, введите ссылку на изображение');
            }
        });
    }

    initColorPanel() {
        const colorItems = document.querySelectorAll('.color-item');
        const colorPicker = document.getElementById('customColorPicker');
        
        colorItems.forEach(item => {
            if (!item.classList.contains('color-custom')) {
                item.addEventListener('click', () => {
                    const color = item.getAttribute('data-color');
                    this.selectColor(color);
                    
                    colorItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    
                    this.currentBackground = null;
                    document.querySelectorAll('.background-item').forEach(bg => bg.classList.remove('active'));
                    
                    this.previewColor(color);
                });
            }
        });
        
        colorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            this.selectColor(color);
            
            colorItems.forEach(i => i.classList.remove('active'));
            
            this.currentBackground = null;
            document.querySelectorAll('.background-item').forEach(bg => bg.classList.remove('active'));
            
            this.previewColor(color);
        });

        document.getElementById('applyColorBtn').addEventListener('click', () => {
            this.showEmployeeData = false;
            this.isSegmentationActive = true;
            this.applyColorBackground();
            document.getElementById('previewContainer').style.display = 'none';
        });
    }

    togglePanels() {
        const backgroundPanel = document.getElementById('backgroundPanel');
        const colorPanel = document.getElementById('colorPanel');
        const toggleBtn = document.getElementById('panelToggle');
        
        if (backgroundPanel.style.display !== 'none') {
            backgroundPanel.style.display = 'none';
            colorPanel.style.display = 'block';
            toggleBtn.textContent = '🖼️';
        } else {
            colorPanel.style.display = 'none';
            backgroundPanel.style.display = 'block';
            toggleBtn.textContent = '🎨';
        }
    }

    selectBackground(path) {
        this.currentBackground = path;
    }

    selectColor(color) {
        this.selectedColor = color;
    }

    previewBackground(path) {
        const img = document.getElementById('previewImage');
        if (path && path.trim() !== '') {
            img.src = path;
            document.getElementById('previewContainer').style.display = 'block';
        }
    }

    previewColor(color) {
        const img = document.getElementById('previewImage');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 200;
        tempCanvas.height = 150;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.fillStyle = color;
        tempCtx.fillRect(0, 0, 200, 150);
        
        tempCtx.fillStyle = '#ffffff';
        tempCtx.font = '14px Arial';
        tempCtx.textAlign = 'center';
        tempCtx.fillText(color, 100, 80);
        
        img.src = tempCanvas.toDataURL();
        document.getElementById('previewContainer').style.display = 'block';
    }

    async applyBackground() {
        if (!this.currentBackground) {
            alert('Выберите фон из списка');
            return;
        }
        
        try {
            const generatedUrl = await generateBackground(this.currentBackground, this.showEmployeeData);
            if (generatedUrl) {
                this.backgroundImage.src = generatedUrl;
            } else {
                console.error('Не удалось сгенерировать фон, применяю базовый');
                this.backgroundImage.src = this.currentBackground;
            }
        } catch (err) {
            console.error('Ошибка при генерации фона:', err);
            this.backgroundImage.src = this.currentBackground;
        }
    }

    async applyColorBackground() {
        if (!this.selectedColor) {
            alert('Выберите цвет из палитры');
            return;
        }
        
        try {
            const colorCanvas = document.createElement('canvas');
            colorCanvas.width = 1920;
            colorCanvas.height = 1080;
            const colorCtx = colorCanvas.getContext('2d');
            
            colorCtx.fillStyle = this.selectedColor;
            colorCtx.fillRect(0, 0, 1920, 1080);
            
            const colorDataUrl = colorCanvas.toDataURL('image/png');
            
            if (this.showEmployeeData) {
                const generatedUrl = await generateBackground(colorDataUrl, true);
                if (generatedUrl) {
                    this.backgroundImage.src = generatedUrl;
                } else {
                    this.backgroundImage.src = colorDataUrl;
                }
            } else {
                this.backgroundImage.src = colorDataUrl;
            }
        } catch (err) {
            console.error('Ошибка при применении цветного фона:', err);
        }
    }

    collectEmployeeData() {
        this.employee.setFullName(document.getElementById('full_name').value);
        this.employee.setPosition(document.getElementById('position').value);
        this.employee.setCompany(document.getElementById('company').value);
        this.employee.setDepartment(document.getElementById('department').value);
        this.employee.setOfficeLocation(document.getElementById('office_location').value);
        this.employee.setEmail(document.getElementById('email').value);
        this.employee.setTelegram(document.getElementById('telegram').value);
        this.employee.setLogoUrl(document.getElementById('logo_url').value);
        this.employee.setSlogan(document.getElementById('slogan').value);
        this.employee.setPrivacy(document.getElementById('privacy_level').value);
    }

    loadEmployeeData() {
        const saved = localStorage.getItem('employee_data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                const emp = data.employee;
                
                document.getElementById('full_name').value = emp.full_name || '';
                document.getElementById('position').value = emp.position || '';
                document.getElementById('company').value = emp.company || '';
                document.getElementById('department').value = emp.department || '';
                document.getElementById('office_location').value = emp.office_location || '';
                document.getElementById('email').value = emp.contact?.email || '';
                document.getElementById('telegram').value = emp.contact?.telegram || '';
                document.getElementById('logo_url').value = emp.branding?.logo_url || '';
                document.getElementById('slogan').value = emp.branding?.slogan || '';
                document.getElementById('privacy_level').value = emp.privacy_level || 'medium';
                
                if (emp.full_name && emp.position) {
                    const showDataBtn = document.getElementById('showDataBtn');
                    const showDataColorBtn = document.getElementById('showDataColorBtn');
                    showDataBtn.disabled = false;
                    showDataBtn.classList.add('enabled');
                    showDataColorBtn.disabled = false;
                    showDataColorBtn.classList.add('enabled');
                }
            } catch (e) {
                console.error('Ошибка загрузки данных:', e);
            }
        }
    }

    calculateGPULoad() {
        const baseLoad = 20;
        const fpsFactor = Math.max(0, (60 - this.fps) / 2);
        const randomVariation = Math.random() * 10 - 5;
        
        return Math.min(100, Math.max(0, baseLoad + fpsFactor + randomVariation));
    }

    updateAverageValues(instantFps, instantGpu) {
        const now = performance.now();
        
        this.fpsValues.push({ value: instantFps, time: now });
        this.gpuValues.push({ value: instantGpu, time: now });
        
        const oneSecondAgo = now - 1000;
        this.fpsValues = this.fpsValues.filter(item => item.time > oneSecondAgo);
        this.gpuValues = this.gpuValues.filter(item => item.time > oneSecondAgo);
        
        if (this.fpsValues.length > 0) {
            const fpsSum = this.fpsValues.reduce((sum, item) => sum + item.value, 0);
            this.fps = fpsSum / this.fpsValues.length;
        }
        
        if (this.gpuValues.length > 0) {
            const gpuSum = this.gpuValues.reduce((sum, item) => sum + item.value, 0);
            this.gpuLoad = gpuSum / this.gpuValues.length;
        }
    }

    drawFrame() {
        if (this.video.readyState < 2) return;

        const { videoWidth: w, videoHeight: h } = this.video;
        
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.maskCanvas.width = w;
            this.maskCanvas.height = h;
        }

        const now = performance.now();
        const deltaTime = now - this.lastTime;
        const instantFps = 1000 / deltaTime;
        const instantGpu = this.calculateGPULoad();
        
        this.lastTime = now;
        this.frameCount++;

        this.updateAverageValues(instantFps, instantGpu);

        const ctx = this.ctx;
        ctx.clearRect(0, 0, w, h);
        
        if (this.isSegmentationActive && this.selfieSegmentation) {
            // Режим с сегментацией: рисуем выбранный фон и человека поверх него
            if (this.backgroundImage.src) {
                ctx.drawImage(this.backgroundImage, 0, 0, w, h);
            }
            
            // Рисуем видео с применением маски сегментации
            ctx.save();
            ctx.drawImage(this.video, 0, 0, w, h);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(this.maskCanvas, 0, 0, w, h);
            ctx.restore();
        } else {
            // Обычный режим без сегментации
            if (this.backgroundImage.src) {
                ctx.drawImage(this.backgroundImage, 0, 0, w, h);
            }
            ctx.drawImage(this.video, 0, 0, w, h);
        }
        
        this.fpsDisplay.textContent = `FPS: ${this.fps.toFixed(1)}`;
        this.gpuDisplay.textContent = `GPU: ${this.gpuLoad.toFixed(1)}%`;
    }

    loop() {
        this.drawFrame();
        requestAnimationFrame(() => this.loop());
    }
}

const app = new DigitalDressCodeUI();
window.employeeInstance = app.employee;