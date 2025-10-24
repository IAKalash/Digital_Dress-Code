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
    setSlogan(v) { this.employee.branding.slogan = v; }
    setPrivacy(v) { this.employee.privacy_level = v; }

    save_to_json() {
        const data = JSON.stringify({ employee: this.employee }, null, 2);
        localStorage.setItem('employee_data', data);
        alert('Данные сохранены!');
    }
}

// === Основной UI ===

class DigitalDressCodeUI {
    constructor() {
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('output');
        this.ctx = this.canvas.getContext('2d');
        this.bgSelect = document.getElementById('backgroundSelect');
        this.background = new Image();
        this.background.src = this.bgSelect.value;

        this.employee = new Employee();
        this.lastTime = performance.now();
        this.fps = 0;

        this.fpsDisplay = document.getElementById('fpsDisplay');

        this.initCamera();
        this.loop();

        // UI элементы
        this.bgSelect.addEventListener('change', () => this.previewBackground(this.bgSelect.value));
        document.getElementById('previewBtn').addEventListener('click', () => this.previewBackground(this.bgSelect.value));
        document.getElementById('applyBtn').addEventListener('click', () => this.applyBackground());
        
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
    }

    async initCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.video.srcObject = stream;
    }

    previewBackground(path) {
        const img = document.getElementById('previewImage');
        img.src = path;
        document.getElementById('previewContainer').style.display = 'block';
    }

    async applyBackground() {
        const basePath = this.bgSelect.value;
        try {
            const generatedUrl = await generateBackground(basePath);
            if (generatedUrl) {
                this.background.src = generatedUrl;
            } else {
                console.error('Не удалось сгенерировать фон, применяю базовый');
                this.background.src = basePath;
            }
        } catch (err) {
            console.error('Ошибка при генерации фона:', err);
            this.background.src = basePath; // Фоллбек на базовый
        }
        document.getElementById('previewContainer').style.display = 'none';
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

    drawFrame() {
        if (this.video.readyState < 2) return;

        const { videoWidth: w, videoHeight: h } = this.video;
        this.canvas.width = w;
        this.canvas.height = h;

        const now = performance.now();
        this.fps = 1000 / (now - this.lastTime);
        this.lastTime = now;

        const ctx = this.ctx;
        ctx.drawImage(this.background, 0, 0, w, h);
        ctx.drawImage(this.video, 0, 0, w, h);
        
        // обновляем поле FPS
        this.fpsDisplay.textContent = `FPS: ${this.fps.toFixed(1)}`;
    }

    loop() {
        this.drawFrame();
        requestAnimationFrame(() => this.loop());
    }
}
const app = new DigitalDressCodeUI();
window.employeeInstance = app.employee;