import io
from PIL import Image, ImageDraw, ImageFont
import qrcode
import os

# Вспомогательные функции для контраста (WCAG)
def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def get_luminance(r, g, b):
    a = [v / 255.0 for v in (r, g, b)]
    a = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in a]
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722

def get_contrast_ratio(bg_rgb, fg_rgb):
    bg_lum = get_luminance(*bg_rgb)
    fg_lum = get_luminance(*fg_rgb)
    return (max(bg_lum, fg_lum) + 0.05) / (min(bg_lum, fg_lum) + 0.05)

def choose_text_color(bg_hex):
    bg_rgb = hex_to_rgb(bg_hex)
    white_rgb = (255, 255, 255)
    black_rgb = (0, 0, 0)
    white_contrast = get_contrast_ratio(bg_rgb, white_rgb)
    black_contrast = get_contrast_ratio(bg_rgb, black_rgb)
    return '#FFFFFF' if white_contrast >= 4.5 else ('#000000' if black_contrast >= 4.5 else '#FFFFFF')

def get_available_fonts():
    font_dir = "fonts"
    available_fonts = []
    if not os.path.exists(font_dir):
        os.makedirs(font_dir)
    for file in os.listdir(font_dir):
        if file.lower().endswith(('.ttf', '.otf')):
            available_fonts.append(os.path.join(font_dir, file))
    return available_fonts or ['arial.ttf', 'DejaVuSans.ttf']

def load_best_font(font_size):
    for font_path in get_available_fonts():
        try:
            return ImageFont.truetype(font_path, font_size)
        except:
            continue
    return ImageFont.load_default()

def split_text(text, max_width, font, draw):
    words, lines, current_line = text.split(), [], []
    for word in words:
        test_line = ' '.join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]
    if current_line:
        lines.append(' '.join(current_line))
    return lines

# Основная функция генератора
def generate_background(employee_data, base_background_path, output_path=None):
    base_img = Image.open(base_background_path).resize((1920, 1080)).convert('RGBA')
    
    # Градиент оверлей
    primary = hex_to_rgb(employee_data['branding']['corporate_colors']['primary'])
    secondary = hex_to_rgb(employee_data['branding']['corporate_colors']['secondary'])
    overlay = Image.new('RGBA', base_img.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    for y in range(base_img.height):
        frac = y / base_img.height
        color = tuple(int(primary[i] * (1 - frac) + secondary[i] * frac) for i in range(3)) + (30,)
        overlay_draw.line([(0, y), (base_img.width, y)], fill=color)
    base_img = Image.alpha_composite(base_img, overlay)
    
    draw = ImageDraw.Draw(base_img)
    
    # Логотип
    try:
        logo = Image.open(employee_data['branding']['logo_url']).convert('RGBA').resize((125, 125))
        base_img.paste(logo, (50, 50), logo)
    except:
        pass
    
    # Шрифты
    font = load_best_font(40)
    slogan_font = load_best_font(30)
    small_font = load_best_font(25)
    
    # Цвета
    primary_color = employee_data['branding']['corporate_colors']['primary']
    text_color_rgb = hex_to_rgb(choose_text_color(primary_color))
    box_colors = {
        'primary': hex_to_rgb(primary_color) + (120,),
        'secondary': hex_to_rgb(employee_data['branding']['corporate_colors']['secondary']) + (100,)
    }
    
    privacy = employee_data['privacy_level']
    shadow = (0, 0, 0, 128) if text_color_rgb[0] > 128 else (255, 255, 255, 128)

    # Функция для одиночного текста
    def draw_text(text, x, y, font_type=font, box_type='primary', align='left', v_pad=12):
        bbox = draw.textbbox((0, 0), text, font=font_type)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        offset_y = bbox[1]
        
        if align == 'right':
            x = base_img.width - w - 70
        elif align == 'center':
            x = (base_img.width - w) // 2
        
        box_left = x - 10
        box_right = x + w + 10
        box_top = y
        box_bottom = y + h + 2 * v_pad
        
        draw.rounded_rectangle((box_left, box_top, box_right, box_bottom), radius=15, fill=box_colors[box_type])
        text_y = y + v_pad - offset_y
        draw.text((x + 2, text_y + 2), text, font=font_type, fill=shadow)
        draw.text((x, text_y), text, font=font_type, fill=text_color_rgb)
        
        return h + 2 * v_pad

    # Функция для многострочного текста в одной рамке
    def draw_multi_text(lines, x, y, font_type=font, box_type='primary', align='left', v_pad=12, line_spacing=5):
        if not lines:
            return 0
        
        # Вычисляем общие размеры
        bboxes = [draw.textbbox((0, 0), line, font=font_type) for line in lines]
        widths = [b[2] - b[0] for b in bboxes]
        heights = [b[3] - b[1] for b in bboxes]
        max_w = max(widths)
        total_h = sum(heights) + line_spacing * (len(lines) - 1)
        
        # Вычисляем позицию для выравнивания
        if align == 'right':
            x = base_img.width - max_w - 70
        
        # Рисуем общую рамку
        box_left = x - 10
        box_right = x + max_w + 10
        box_top = y
        box_bottom = y + total_h + 2 * v_pad
        
        draw.rounded_rectangle((box_left, box_top, box_right, box_bottom), radius=15, fill=box_colors[box_type])
        
        # Рисуем текст
        current_y = y + v_pad
        for i, line in enumerate(lines):
            line_x = x
            if align == 'right':
                line_x = base_img.width - widths[i] - 70
            
            text_y = current_y - bboxes[i][1]  # Учитываем offset_y для каждой строки
            draw.text((line_x + 2, text_y + 2), line, font=font_type, fill=shadow)
            draw.text((line_x, text_y), line, font=font_type, fill=text_color_rgb)
            current_y += heights[i] + line_spacing
        
        return total_h + 2 * v_pad

    # Левая нижняя часть: должность и ФИО в одной рамке
    position_lines = split_text(employee_data['position'], 500, font, draw)
    all_left_lines = position_lines + [employee_data['full_name']]
    
    # Вычисляем высоту всего блока
    bboxes = [draw.textbbox((0, 0), line, font=font) for line in all_left_lines]
    heights = [b[3] - b[1] for b in bboxes]
    total_left_height = sum(heights) + 5 * (len(all_left_lines) - 1) + 24  # line_spacing=5, v_pad=12*2=24
    
    # Позиционируем блок
    margin_bottom = 50
    left_start_y = base_img.height - total_left_height - margin_bottom
    
    # Рисуем единую рамку для левого нижнего угла
    draw_multi_text(all_left_lines, 50, left_start_y, box_type='primary', line_spacing=5)

    # Правая верхняя часть: компания, отдел, локация в одной рамке
    if privacy in ['medium', 'high']:
        right_lines = [
            employee_data['company'],
            employee_data['department'], 
            employee_data['office_location']
        ]
        y_tr = 120
        draw_multi_text(right_lines, 0, y_tr, box_type='secondary', align='right', line_spacing=5)

    # QR-коды для high privacy
    if privacy == 'high':
        qr_size = 128
        qr_padding = 20
        total_qr_width = qr_size * 2 + qr_padding
        start_x = base_img.width - total_qr_width - 100
        y_br = base_img.height - 220
        
        # Заголовок "Контакты" - центрируем между QR-кодами
        contacts_bbox = draw.textbbox((0, 0), "Контакты", font=font)
        contacts_width = contacts_bbox[2] - contacts_bbox[0]
        contacts_x = start_x + total_qr_width // 2 - contacts_width // 2
        draw_text("Контакты", contacts_x, y_br - 50, v_pad=12)
        
        # QR-коды и подписи
        qr_data = [
            (f"mailto:{employee_data['contact']['email']}", "Email", 'primary'),
            (f"https://t.me/{employee_data['contact']['telegram'].replace('@', '')}", "Telegram", 'secondary')
        ]
        
        for i, (data, label, box_type) in enumerate(qr_data):
            x_pos = start_x + i * (qr_size + qr_padding)
            
            # QR-код
            qr = qrcode.QRCode(box_size=5)
            qr.add_data(data)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white").resize((qr_size, qr_size)).convert('RGBA')
            qr_bg = Image.new('RGBA', (qr_size + 20, qr_size + 20), box_colors[box_type])
            qr_bg.paste(qr_img, (10, 10), qr_img)
            base_img.paste(qr_bg, (x_pos, y_br), qr_bg)
            
            # Подпись центрированная под QR-кодом
            label_bbox = draw.textbbox((0, 0), label, font=small_font)
            label_width = label_bbox[2] - label_bbox[0]
            label_x = x_pos + (qr_size + 20) // 2 - label_width // 2
            draw_text(label, label_x, y_br + qr_size + 30, font_type=small_font, box_type=box_type, v_pad=8)

    # Слоган в центре сверху
    slogan = employee_data['branding']['slogan']
    draw_text(slogan, 0, 50, font_type=slogan_font, box_type='secondary', v_pad=12, align='center')

    # Сохранение
    if output_path:
        base_img.save(output_path, format='PNG')
        return output_path
    else:
        buffered = io.BytesIO()
        base_img.save(buffered, format='PNG')
        return buffered.getvalue()

# Пример использования
if __name__ == "__main__":
    example_data = {
        "full_name": "Иванов Сергей Петрович",
        "position": "Ведущий инженер по компьютерному зрению с очень длинным названием должности",
        "company": "ООО «Рога и Копыта»",
        "department": "Департамент компьютерного зрения",
        "office_location": "Новосибирск, технопарк «Идея»",
        "contact": {
            "email": "sergey.ivanov@t1dp.ru",
            "telegram": "@sergey_vision"
        },
        "branding": {
            "logo_url": "./testData/logos/medium_9eb9cd58b9ea5e04c890326b5c1f471f.png",
            "corporate_colors": {
                "primary": "#0052CC",
                "secondary": "#00B8D9"
            },
            "slogan": "Инновации в каждый кадр"
        },
        "privacy_level": "high"
    }
    output = generate_background(example_data, "./testData/Back/1920х1080_4.png", "generated_background.png")
    print(f"Generated: {output}")