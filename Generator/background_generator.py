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

# Основная функция генератора
def generate_background(employee_data, base_background_path, output_path=None):
    # Загрузка базового фона
    base_img = Image.open(base_background_path)
    base_img = base_img.resize((1920, 1080)).convert('RGBA')
    
    # Overlay градиент на основе corporate_colors (полупрозрачный)
    primary = hex_to_rgb(employee_data['branding']['corporate_colors']['primary'])
    secondary = hex_to_rgb(employee_data['branding']['corporate_colors']['secondary'])
    overlay = Image.new('RGBA', base_img.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    for y in range(base_img.height):
        frac = y / base_img.height
        color = tuple(int(primary[i] * (1 - frac) + secondary[i] * frac) for i in range(3)) + (80,)  # alpha ~30%
        overlay_draw.line([(0, y), (base_img.width, y)], fill=color)
    base_img = Image.alpha_composite(base_img, overlay)
    
    # ВАЖНО: Пересоздаем draw после alpha_composite
    draw = ImageDraw.Draw(base_img)
    
    # Добавление логотипа
    logo_path = employee_data['branding']['logo_url']
    try:
        logo = Image.open(logo_path).convert('RGBA')
        logo = logo.resize((200, 200))
        base_img.paste(logo, (50, 50), logo)
    except Exception as e:
        print(f"Warning: Could not load logo from {logo_path}: {e}")

    # Загрузка шрифта с улучшенным fallback
    font_size = 40
    slogan_font_size = 30
    
    # Попробуем разные шрифты
    font_paths = [
        'arial.ttf',
        '/System/Library/Fonts/Arial.ttf',  # Mac
        '/usr/share/fonts/truetype/freefont/FreeSans.ttf',  # Linux
        'C:/Windows/Fonts/arial.ttf',  # Windows
    ]
    
    font = None
    slogan_font = None
    
    for font_path in font_paths:
        try:
            if os.path.exists(font_path):
                font = ImageFont.truetype(font_path, font_size)
                slogan_font = ImageFont.truetype(font_path, slogan_font_size)
                print(f"Using font: {font_path}")
                break
        except Exception:
            continue
    
    # Если шрифты не найдены, используем default
    if font is None:
        print("Warning: No TrueType fonts found. Using default font (text may be small).")
        font = ImageFont.load_default()
        slogan_font = ImageFont.load_default()

    bg_color_for_contrast = employee_data['branding']['corporate_colors']['primary']
    text_color_hex = choose_text_color(bg_color_for_contrast)
    text_color_rgb = hex_to_rgb(text_color_hex)
    shadow_color_rgb = (0, 0, 0) if text_color_hex == '#FFFFFF' else (255, 255, 255)
    
    # Полупрозрачный фон за текстом
    box_color = (0, 0, 0, 128) if text_color_hex == '#FFFFFF' else (255, 255, 255, 128)

    y = 300
    privacy = employee_data['privacy_level']
    
    def draw_text(text, x, y, local_font=font):
        # Получаем размеры текста
        try:
            # Для PIL >= 8.0.0 используем textbbox
            if hasattr(draw, 'textbbox'):
                text_bbox = draw.textbbox((x, y), text, font=local_font)
            else:
                # Для старых версий используем textsize
                text_width, text_height = draw.textsize(text, font=local_font)
                text_bbox = (x, y, x + text_width, y + text_height)
        except Exception as e:
            print(f"Error calculating text size: {e}")
            # Fallback bbox
            text_bbox = (x, y, x + len(text) * 20, y + 40)
        
        box_padding = 10
        draw.rectangle(
            (text_bbox[0] - box_padding, text_bbox[1] - box_padding, 
             text_bbox[2] + box_padding, text_bbox[3] + box_padding),
            fill=box_color
        )
        # Тень и текст
        draw.text((x + 2, y + 2), text, font=local_font, fill=shadow_color_rgb)
        draw.text((x, y), text, font=local_font, fill=text_color_rgb)
        return text_bbox[3] - text_bbox[1]  # возвращаем высоту текста

    # Рисуем текст с информацией
    try:
        text_height = draw_text(employee_data['full_name'], 50, y)
        y += text_height + 20
        
        text_height = draw_text(employee_data['position'], 50, y)
        y += text_height + 20
        
        if privacy in ['medium', 'high']:
            text_height = draw_text(employee_data['company'], 50, y)
            y += text_height + 20
            
            text_height = draw_text(employee_data['department'], 50, y)
            y += text_height + 20
            
            text_height = draw_text(employee_data['office_location'], 50, y)
            y += text_height + 20
        
        if privacy == 'high':
            text_height = draw_text(employee_data['contact']['email'], 50, y)
            y += text_height + 20
            
            text_height = draw_text(employee_data['contact']['telegram'], 50, y)
            y += text_height + 20
            
            # QR для email
            qr = qrcode.QRCode(box_size=5)
            qr.add_data(f"mailto:{employee_data['contact']['email']}")
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white").resize((128, 128))
            # Конвертируем в RGBA для прозрачности
            qr_img = qr_img.convert('RGBA')
            base_img.paste(qr_img, (50, y))
            y += 150
            
            # QR для telegram
            tg_username = employee_data['contact']['telegram'].replace('@', '')
            qr = qrcode.QRCode(box_size=5)
            qr.add_data(f"https://t.me/{tg_username}")
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white").resize((128, 128))
            qr_img = qr_img.convert('RGBA')
            base_img.paste(qr_img, (50, y))
            y += 150
        
        # Slogan внизу
        slogan_height = draw_text(employee_data['branding']['slogan'], 50, base_img.height - 80, local_font=slogan_font)
        
    except Exception as e:
        print(f"Error drawing text: {e}")

    # Сохранение
    if output_path:
        base_img.save(output_path, format='PNG')
        print(f"Background saved to: {output_path}")
        return output_path
    else:
        buffered = io.BytesIO()
        base_img.save(buffered, format='PNG')
        buffered.seek(0)
        return buffered.read()

# Пример использования
if __name__ == "__main__":
    example_data = {
        "full_name": "Иванов Сергей Петрович",
        "position": "Ведущий инженер по компьютерному зрению",
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
    
    base_path = "./testData/Back/white.png"
    output = generate_background(example_data, base_path, output_path="generated_background.png")
    print(f"Generated: {output}")