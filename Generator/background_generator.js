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

// === ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ ===
async function generateBackground(baseBackgroundPath) {
    // Получаем данные сотрудника из глобальной переменной
    const employee = window.employeeInstance;
    if (!employee) {
        console.error('window.employeeInstance не определён');
        return null;
    }
    const info = employee.employee;
    
    // Создаём canvas
    const WIDTH = 1920, HEIGHT = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');

    // Загрузка фона
    try {
        const baseImg = new Image();
        baseImg.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
            baseImg.onload = resolve;
            baseImg.onerror = reject;
            baseImg.src = baseBackgroundPath;
        });
        ctx.drawImage(baseImg, 0, 0, WIDTH, HEIGHT);
    } catch (err) {
        console.warn('Не удалось загрузить фоновое изображение:', err.message);
        return null;
    }

    // Градиентный оверлей (всегда)
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

    // Логотип (всегда, если URL)
    if (info.branding.logo_url) {
        try {
            const logo = new Image();
            logo.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                logo.onload = resolve;
                logo.onerror = reject;
                logo.src = info.branding.logo_url;
            });
            const logoSize = 125;
            ctx.drawImage(logo, 50, 50, logoSize, logoSize);
        } catch (err) {
            console.warn('Не удалось загрузить логотип:', err.message);
        }
    }

    // Шрифты
    const fontFamily = 'Arial';
    const font40 = `40px ${fontFamily}`;
    const font30 = `30px ${fontFamily}`;
    const font25 = `25px ${fontFamily}`;
    ctx.font = font40;

    // Цвета
    const primaryColor = info.branding.corporate_colors.primary;
    const textColor = chooseTextColor(primaryColor);
    const textColorRgb = hexToRgb(textColor);
    const shadowColor = textColorRgb.r > 128 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
    const primaryHex = primaryColor.replace('#', '');
    const secondaryHex = info.branding.corporate_colors.secondary.replace('#', '');
    const boxColors = {
        primary: `#${primaryHex}77`,
        secondary: `#${secondaryHex}64`
    };

    // Вспомогательные функции (с исправлением для пустых текстов)
    function setFont(size) {
        ctx.font = `${size}px ${fontFamily}`;
    }

    function getTextWidth(text, size = 40) {
        setFont(size);
        return ctx.measureText(text || '').width;
    }

    function splitText(text, maxWidth, fontSize = 40) {
        if (!text) return [];
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
        if (lines.length === 0) return 0; // Пропуск пустого текста
        const lineHeights = lines.map(() => fontSize * 0.8);
        const totalHeight = lineHeights.reduce((a, b) => a + b, 0) + lineSpacing * (lines.length - 1);
        const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width), 1); // Минимум 1 для избежания ошибок
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
            ctx.fillStyle = shadowColor;
            ctx.fillText(line, lineX + 2, currentY + 2);
            ctx.fillStyle = textColor;
            ctx.fillText(line, lineX, currentY);
            currentY += lineHeights[i] + lineSpacing;
        });
        return totalHeight + 2 * vPad;
    }

    // === ОСНОВНАЯ ЛОГИКА РАСПОЛОЖЕНИЯ ===
    // Low и выше: имя, должность
    const positionLines = splitText(info.position, 500, 40);
    const leftLines = [...positionLines, info.full_name].filter(line => line);
    if (leftLines.length > 0) {
        const leftBlockHeight = drawTextWithBox(leftLines, 50, HEIGHT - 200, {
            vPad: 12,
            lineSpacing: 5
        });
        const leftStartY = HEIGHT - leftBlockHeight - 50;
        drawTextWithBox(leftLines, 50, leftStartY, { vPad: 12, lineSpacing: 5 });
    }

    // Medium и выше: компания, отдел, локация
    if (['medium', 'high'].includes(info.privacy_level)) {
        const rightLines = [info.company, info.department, info.office_location].filter(Boolean);
        if (rightLines.length > 0) {
            drawTextWithBox(rightLines, 0, 120, {
                boxType: 'secondary',
                align: 'right',
                vPad: 12,
                lineSpacing: 5
            });
        }
    }

    // High: контакты (QR)
    if (info.privacy_level === 'high') {
        const qrSize = 128;
        const qrPadding = 20;
        const totalQrWidth = qrSize * 2 + qrPadding;
        const startX = WIDTH - totalQrWidth - 100;
        const yBr = HEIGHT - 220;
        drawTextWithBox("Контакты", 0, yBr - 50, { align: 'center', vPad: 12 });
        const qrData = [];
        if (info.contact.email) qrData.push([`mailto:${info.contact.email}`, "Email", 'primary']);
        if (info.contact.telegram) qrData.push([`https://t.me/${info.contact.telegram.replace('@', '')}`, "Telegram", 'secondary']);
        for (let i = 0; i < qrData.length; i++) {
            const [data, label, boxType] = qrData[i];
            const xPos = startX + i * (qrSize + qrPadding);
            drawRoundedRect(xPos, yBr, qrSize + 20, qrSize + 20, 15, boxColors[boxType]);
            const qrCanvas = document.createElement('canvas');
            qrCanvas.width = qrSize;
            qrCanvas.height = qrSize;
            try {
                await QRCode.toCanvas(qrCanvas, data, {
                    width: qrSize,
                    color: { dark: '#000000', light: '#FFFFFF' }
                });
                ctx.drawImage(qrCanvas, xPos + 10, yBr + 10);
            } catch (err) {
                console.warn('Не удалось сгенерировать QR-код:', err.message);
            }
            drawTextWithBox(label, xPos + 10, yBr + qrSize + 30, {
                fontSize: 25,
                boxType,
                align: 'center',
                vPad: 8
            });
        }
    }

    // Слоган (всегда, если есть)
    if (info.branding.slogan) {
        drawTextWithBox(info.branding.slogan, 0, 50, {
            fontSize: 30,
            boxType: 'secondary',
            align: 'center',
            vPad: 12
        });
    }

    // Возвращаем dataURL
    return canvas.toDataURL('image/png');
}