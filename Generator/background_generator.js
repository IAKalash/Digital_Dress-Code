// generate-background.js
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const QRCode = require('qrcode');
const prompt = require('prompt-sync')({ sigint: true });

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    return {
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16)
    };
}

function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(bg, fg) {
    const bgLum = getLuminance(bg.r, bg.g, bg.b);
    const fgLum = getLuminance(fg.r, fg.g, fg.b);
    return (Math.max(bgLum, fgLum) + 0.05) / (Math.min(bgLum, fgLum) + 0.05);
}

function chooseTextColor(bgHex) {
    const bg = hexToRgb(bgHex);
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    const whiteContrast = getContrastRatio(bg, white);
    const blackContrast = getContrastRatio(bg, black);
    return whiteContrast >= 4.5 ? '#FFFFFF' : (blackContrast >= 4.5 ? '#000000' : '#FFFFFF');
}

function getAvailableFonts() {
    const fontDir = 'fonts';
    if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });
    return fs.readdirSync(fontDir)
        .filter(file => /\.(ttf|otf)$/i.test(file))
        .map(file => path.join(fontDir, file));
}

// === КЛАСС EMPLOYEE ===

class Employee {
    constructor({
        full_name = '',
        position = '',
        company = '',
        department = '',
        office_location = '',
        contact = { email: '', telegram: '' },
        branding = {
            logo_url: '',
            corporate_colors: { primary: '', secondary: '' },
            slogan: ''
        },
        privacy_level = ''
    } = {}) {
        this.full_name = full_name;
        this.position = position;
        this.company = company;
        this.department = department;
        this.office_location = office_location;
        this.contact = contact;
        this.branding = branding;
        this.privacy_level = privacy_level;

        this._validateContact();
        this._validateBranding();
        this._validatePrivacyLevel();
    }

    _validateContact() {
        if (!this.contact || typeof this.contact !== 'object' || !('email' in this.contact) || !('telegram' in this.contact)) {
            throw new Error("Contact must be an object with 'email' and 'telegram' keys");
        }
        if (this.contact.email && !/^[^@]+@[^@]+\.[^@]+$/.test(this.contact.email)) {
            throw new Error("Invalid email format");
        }
    }

    _validateBranding() {
        const b = this.branding;
        if (!b || typeof b !== 'object' || !('logo_url' in b) || !('corporate_colors' in b) || !('slogan' in b)) {
            throw new Error("Branding must contain 'logo_url', 'corporate_colors', and 'slogan'");
        }
        const cc = b.corporate_colors;
        if (!cc || !('primary' in cc) || !('secondary' in cc)) {
            throw new Error("corporate_colors must have 'primary' and 'secondary'");
        }
        [cc.primary, cc.secondary].forEach(color => {
            if (color && !/^#([0-9a-fA-F]{3}){1,2}$/.test(color)) {
                throw new Error(`Invalid HEX color: ${color}`);
            }
        });
    }

    _validatePrivacyLevel() {
        if (this.privacy_level && !['low', 'medium', 'high'].includes(this.privacy_level)) {
            throw new Error("Privacy level must be 'low', 'medium', or 'high'");
        }
    }

    static fromInput() {
        console.log("Введите данные сотрудника:");
        const full_name = prompt("Полное имя: ");
        const position = prompt("Должность: ");
        const company = prompt("Компания: ");
        const department = prompt("Департамент: ");
        const office_location = prompt("Местоположение офиса: ");

        console.log("\nВведите контактные данные:");
        const email = prompt("Email: ");
        const telegram = prompt("Telegram: ");

        console.log("\nВведите данные брендинга:");
        const logo_url = prompt("URL логотипа (или путь): ");
        const primary_color = prompt("Основной цвет (HEX): ");
        const secondary_color = prompt("Вторичный цвет (HEX): ");
        const slogan = prompt("Слоган: ");

        const privacy_level = prompt("\nУровень конфиденциальности (low/medium/high): ");

        return new Employee({
            full_name, position, company, department, office_location,
            contact: { email, telegram },
            branding: { logo_url, corporate_colors: { primary: primary_color, secondary: secondary_color }, slogan },
            privacy_level
        });
    }

    static fromJson(filename) {
        try {
            const data = JSON.parse(fs.readFileSync(filename, 'utf-8'));
            if (!data.employee) throw new Error("JSON must contain 'employee' key");
            return new Employee(data.employee);
        } catch (err) {
            if (err.code === 'ENOENT') throw new Error(`File ${filename} not found`);
            if (err instanceof SyntaxError) throw new Error("Invalid JSON format");
            throw err;
        }
    }

    getLowInfo() {
        return { full_name: this.full_name, position: this.position };
    }

    getMediumInfo() {
        return {
            full_name: this.full_name,
            position: this.position,
            company: this.company,
            department: this.department,
            office_location: this.office_location
        };
    }

    getHighInfo() {
        return {
            full_name: this.full_name,
            position: this.position,
            company: this.company,
            department: this.department,
            office_location: this.office_location,
            contact: this.contact,
            branding: this.branding,
            privacy_level: this.privacy_level
        };
    }
}

// === ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ ===

async function generateBackground(employeeData, baseBackgroundPath, outputPath = null) {
    const employee = employeeData instanceof Employee ? employeeData : new Employee(employeeData);
    const info = employee.getHighInfo();

    const WIDTH = 1920, HEIGHT = 1080;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Загрузка фона
    const baseImg = await loadImage(baseBackgroundPath);
    ctx.drawImage(baseImg, 0, 0, WIDTH, HEIGHT);

    // Градиентный оверлей
    const primary = hexToRgb(info.branding.corporate_colors.primary);
    const secondary = hexToRgb(info.branding.corporate_colors.secondary);
    for (let y = 0; y < HEIGHT; y++) {
        const frac = y / HEIGHT;
        const r = Math.round(primary.r * (1 - frac) + secondary.r * frac);
        const g = Math.round(primary.g * (1 - frac) + secondary.g * frac);
        const b = Math.round(primary.b * (1 - frac) + secondary.b * frac);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.12)`;
        ctx.fillRect(0, y, WIDTH, 1);
    }

    // Логотип
    if (info.branding.logo_url) {
        try {
            const logo = await loadImage(info.branding.logo_url);
            const logoSize = 125;
            ctx.drawImage(logo, 50, 50, logoSize, logoSize);
        } catch (err) {
            console.warn("Не удалось загрузить логотип:", err.message);
        }
    }

    // Шрифты
    const fonts = getAvailableFonts();
    const defaultFont = fonts.length > 0 ? fonts[0] : null;
    if (defaultFont) registerFont(defaultFont, { family: 'CustomFont' });

    const fontFamily = defaultFont ? 'CustomFont' : 'Arial';
    const font40 = `${40}px ${fontFamily}`;
    const font30 = `${30}px ${fontFamily}`;
    const font25 = `${25}px ${fontFamily}`;
    ctx.font = font40;

    // Цвета
    const primaryColor = info.branding.corporate_colors.primary;
    const textColor = chooseTextColor(primaryColor);
    const textColorRgb = hexToRgb(textColor);
    const shadowColor = textColorRgb.r > 128 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';

    // Исправлено: корректное построение HEX-цветов с альфой
    const primaryHex = primaryColor.replace('#', '');
    const secondaryHex = info.branding.corporate_colors.secondary.replace('#', '');
    const boxColors = {
        primary: `#${primaryHex}77`,   // 120/255 ≈ 0.47 → 77
        secondary: `#${secondaryHex}64` // 100/255 ≈ 0.39 → 64
    };

    // Вспомогательные функции
    function setFont(size) {
        ctx.font = `${size}px ${fontFamily}`;
    }

    function getTextWidth(text, size = 40) {
        setFont(size);
        return ctx.measureText(text).width;
    }

    function splitText(text, maxWidth, fontSize = 40) {
        setFont(fontSize);
        const words = text.split(' ');
        const lines = [];
        let current = [];
        for (const word of words) {
            const test = [...current, word].join(' ');
            if (ctx.measureText(test).width <= maxWidth) {
                current.push(word);
            } else {
                if (current.length) lines.push(current.join(' '));
                current = [word];
            }
        }
        if (current.length) lines.push(current.join(' '));
        return lines;
    }

    function drawRoundedRect(x, y, w, h, r, fill) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
    }

    function drawTextWithBox(text, x, y, options = {}) {
        const {
            fontSize = 40,
            boxType = 'primary',
            align = 'left',
            vPad = 12,
            lineSpacing = 5
        } = options;

        setFont(fontSize);
        const lines = Array.isArray(text) ? text : splitText(text, 500, fontSize);
        const lineHeights = lines.map(() => fontSize * 0.8);
        const totalHeight = lineHeights.reduce((a, b) => a + b, 0) + lineSpacing * (lines.length - 1);
        const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));

        let startX = x;
        if (align === 'right') startX = WIDTH - maxWidth - 70;
        if (align === 'center') startX = (WIDTH - maxWidth) / 2;

        const boxLeft = startX - 10;
        const boxRight = startX + maxWidth + 10;
        const boxTop = y;
        const boxBottom = y + totalHeight + 2 * vPad;

        drawRoundedRect(boxLeft, boxTop, boxRight - boxLeft, boxBottom - boxTop, 15, boxColors[boxType]);

        let currentY = y + vPad;
        lines.forEach((line, i) => {
            const lineWidth = ctx.measureText(line).width;
            const lineX = align === 'right' ? WIDTH - lineWidth - 70 :
                          align === 'center' ? (WIDTH - lineWidth) / 2 : startX;

            // Тень
            ctx.fillStyle = shadowColor;
            ctx.fillText(line, lineX + 2, currentY + 2);
            // Основной текст
            ctx.fillStyle = textColor;
            ctx.fillText(line, lineX, currentY);

            currentY += lineHeights[i] + lineSpacing;
        });

        return totalHeight + 2 * vPad;
    }

    // === ОСНОВНАЯ ЛОГИКА РАСПОЛОЖЕНИЯ ===

    // Левый нижний угол: должность + ФИО
    const positionLines = splitText(info.position, 500, 40);
    const leftLines = [...positionLines, info.full_name];
    const leftBlockHeight = drawTextWithBox(leftLines, 50, HEIGHT - 200, {
        vPad: 12,
        lineSpacing: 5
    });
    const leftStartY = HEIGHT - leftBlockHeight - 50;
    drawTextWithBox(leftLines, 50, leftStartY, { vPad: 12, lineSpacing: 5 });

    // Правый верхний угол: компания, отдел, локация
    if (['medium', 'high'].includes(info.privacy_level)) {
        const rightLines = [info.company, info.department, info.office_location].filter(Boolean);
        drawTextWithBox(rightLines, 0, 120, {
            boxType: 'secondary',
            align: 'right',
            vPad: 12,
            lineSpacing: 5
        });
    }

    // QR-коды (только high)
    if (info.privacy_level === 'high') {
        const qrSize = 128;
        const qrPadding = 20;
        const totalQrWidth = qrSize * 2 + qrPadding;
        const startX = WIDTH - totalQrWidth - 100;
        const yBr = HEIGHT - 220;

        // Заголовок "Контакты"
        drawTextWithBox("Контакты", 0, yBr - 50, { align: 'center', vPad: 12 });

        const qrData = [
            [`mailto:${info.contact.email}`, "Email", 'primary'],
            [`https://t.me/${info.contact.telegram.replace('@', '')}`, "Telegram", 'secondary']
        ];

        for (let i = 0; i < qrData.length; i++) {
            const [data, label, boxType] = qrData[i];
            const xPos = startX + i * (qrSize + qrPadding);

            // QR фон
            drawRoundedRect(xPos, yBr, qrSize + 20, qrSize + 20, 15, boxColors[boxType]);

            // QR код
            const qrCanvas = createCanvas(qrSize, qrSize);
            await QRCode.toCanvas(qrCanvas, data, { width: qrSize, color: { dark: '#000', light: '#FFF' } });
            ctx.drawImage(qrCanvas, xPos + 10, yBr + 10);

            // Подпись
            drawTextWithBox(label, xPos + 10, yBr + qrSize + 30, {
                fontSize: 25,
                boxType,
                align: 'center',
                vPad: 8
            });
        }
    }

    // Слоган по центру сверху
    if (info.branding.slogan) {
        drawTextWithBox(info.branding.slogan, 0, 50, {
            fontSize: 30,
            boxType: 'secondary',
            align: 'center',
            vPad: 12
        });
    }

    // Сохранение
    const buffer = canvas.toBuffer('image/png');
    if (outputPath) {
        fs.writeFileSync(outputPath, buffer);
        return outputPath;
    }
    return buffer;
}

// === ЭКСПОРТ ФУНКЦИЙ ===

async function generateBackgroundFromJson(jsonPath, bgPath, outputPath = null) {
    const employee = Employee.fromJson(jsonPath);
    return await generateBackground(employee, bgPath, outputPath);
}

async function generateBackgroundFromInput(bgPath, outputPath = null) {
    const employee = Employee.fromInput();
    return await generateBackground(employee, bgPath, outputPath);
}

// === ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ ===

(async () => {
    if (require.main === module) {
        try {
            // 1. Из JSON
            const out1 = await generateBackgroundFromJson("data.json", "./testData/Back/1920х1080_4.png", "generated_from_json.png");
            console.log("Сгенерировано из JSON:", out1);

            // 2. Из ввода (раскомментируйте)
            // const out2 = await generateBackgroundFromInput("./testData/Back/1920х1080_4.png", "generated_from_input.png");
            // console.log("Сгенерировано из ввода:", out2);

            // 3. Прямо из объекта
            const exampleEmployee = new Employee({
                full_name: "Иванов Сергей Петрович",
                position: "Ведущий инженер по компьютерному зрению с очень длинным названием должности",
                company: "ООО «Рога и Копыта»",
                department: "Департамент компьютерного зрения",
                office_location: "Новосибирск, технопарк «Идея»",
                contact: {
                    email: "sergey.ivanov@t1dp.ru",
                    telegram: "@sergey_vision"
                },
                branding: {
                    logo_url: "./testData/logos/medium_9eb9cd58b9ea5e04c890326b5c1f471f.png",
                    corporate_colors: { primary: "#0052CC", secondary: "#00B8D9" },
                    slogan: "Инновации в каждый кадр"
                },
                privacy_level: "high"
            });

            const out3 = await generateBackground(exampleEmployee, "./testData/Back/1920х1080_4.png", "generated_from_object.png");
            console.log("Сгенерировано из объекта:", out3);
        } catch (err) {
            console.error("Ошибка:", err.message);
        }
    }
})();

module.exports = {
    Employee,
    generateBackground,
    generateBackgroundFromJson,
    generateBackgroundFromInput
};