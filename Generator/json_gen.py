from dataclasses import dataclass, asdict
from typing import Dict, Any
import json
import re

@dataclass
class Employee:
    full_name: str
    position: str
    company: str
    department: str
    office_location: str
    contact: Dict[str, str]
    branding: Dict[str, Any]
    privacy_level: str

    def __init__(
        self,
        full_name: str = "",
        position: str = "",
        company: str = "",
        department: str = "",
        office_location: str = "",
        contact: Dict[str, str] = None,
        branding: Dict[str, Any] = None,
        privacy_level: str = ""
    ) -> None:
        """Инициализирует объект Employee с значениями по умолчанию и базовой валидацией."""
        self.full_name = full_name
        self.position = position
        self.company = company
        self.department = department
        self.office_location = office_location
        self.contact = contact if contact is not None else {"email": "", "telegram": ""}
        self.branding = branding if branding is not None else {
            "logo_url": "",
            "corporate_colors": {"primary": "", "secondary": ""},
            "slogan": ""
        }
        self.privacy_level = privacy_level

        # Базовая валидация
        self._validate_contact()
        self._validate_branding()
        self._validate_privacy_level()

    def _validate_contact(self) -> None:
        """Проверяет корректность структуры contact и формата email."""
        if not isinstance(self.contact, dict) or sorted(self.contact.keys()) != ["email", "telegram"]:
            raise ValueError("Contact must be a dictionary with 'email' and 'telegram' keys")
        if self.contact["email"] and not re.match(r"[^@]+@[^@]+\.[^@]+", self.contact["email"]):
            raise ValueError("Invalid email format")

    def _validate_branding(self) -> None:
        """Проверяет корректность структуры branding и формата HEX-цветов."""
        if not isinstance(self.branding, dict) or sorted(self.branding.keys()) != ["corporate_colors", "logo_url", "slogan"]:
            raise ValueError("Branding must be a dictionary with 'logo_url', 'corporate_colors', and 'slogan' keys")
        if not isinstance(self.branding["corporate_colors"], dict) or sorted(self.branding["corporate_colors"].keys()) != ["primary", "secondary"]:
            raise ValueError("Corporate_colors must be a dictionary with 'primary' and 'secondary' keys")
        for color in [self.branding["corporate_colors"]["primary"], self.branding["corporate_colors"]["secondary"]]:
            if color and not re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", color):
                raise ValueError(f"Invalid HEX color format: {color}")

    def _validate_privacy_level(self) -> None:
        """Проверяет корректность privacy_level."""
        if self.privacy_level and self.privacy_level not in ["low", "medium", "high"]:
            raise ValueError("Privacy level must be 'low', 'medium', or 'high'")

    def get_full_name(self) -> str:
        return self.full_name

    def set_full_name(self, value: str) -> None:
        self.full_name = value

    def get_position(self) -> str:
        return self.position

    def set_position(self, value: str) -> None:
        self.position = value

    def get_company(self) -> str:
        return self.company

    def set_company(self, value: str) -> None:
        self.company = value

    def get_department(self) -> str:
        return self.department

    def set_department(self, value: str) -> None:
        self.department = value

    def get_office_location(self) -> str:
        return self.office_location

    def set_office_location(self, value: str) -> None:
        self.office_location = value

    def get_contact(self) -> Dict[str, str]:
        return self.contact

    def set_contact(self, value: Dict[str, str]) -> None:
        self.contact = value
        self._validate_contact()

    def get_contact_email(self) -> str:
        return self.contact["email"]

    def set_contact_email(self, value: str) -> None:
        self.contact["email"] = value
        self._validate_contact()

    def get_contact_telegram(self) -> str:
        return self.contact["telegram"]

    def set_contact_telegram(self, value: str) -> None:
        self.contact["telegram"] = value
        self._validate_contact()

    def get_branding(self) -> Dict[str, Any]:
        return self.branding

    def set_branding(self, value: Dict[str, Any]) -> None:
        self.branding = value
        self._validate_branding()

    def get_branding_logo_url(self) -> str:
        return self.branding["logo_url"]

    def set_branding_logo_url(self, value: str) -> None:
        self.branding["logo_url"] = value
        self._validate_branding()

    def get_branding_corporate_colors(self) -> Dict[str, str]:
        return self.branding["corporate_colors"]

    def set_branding_corporate_colors(self, value: Dict[str, str]) -> None:
        self.branding["corporate_colors"] = value
        self._validate_branding()

    def get_branding_corporate_colors_primary(self) -> str:
        return self.branding["corporate_colors"]["primary"]

    def set_branding_corporate_colors_primary(self, value: str) -> None:
        self.branding["corporate_colors"]["primary"] = value
        self._validate_branding()

    def get_branding_corporate_colors_secondary(self) -> str:
        return self.branding["corporate_colors"]["secondary"]

    def set_branding_corporate_colors_secondary(self, value: str) -> None:
        self.branding["corporate_colors"]["secondary"] = value
        self._validate_branding()

    def get_branding_slogan(self) -> str:
        return self.branding["slogan"]

    def set_branding_slogan(self, value: str) -> None:
        self.branding["slogan"] = value
        self._validate_branding()

    def get_privacy_level(self) -> str:
        return self.privacy_level

    def set_privacy_level(self, value: str) -> None:
        self.privacy_level = value
        self._validate_privacy_level()

    @classmethod
    def from_input(cls, data: Dict[str, Any] = None) -> 'Employee':
        """Создаёт экземпляр Employee на основе словаря или ввода пользователя."""
        if data:
            return cls(
                full_name=data.get("full_name", ""),
                position=data.get("position", ""),
                company=data.get("company", ""),
                department=data.get("department", ""),
                office_location=data.get("office_location", ""),
                contact=data.get("contact", {"email": "", "telegram": ""}),
                branding=data.get("branding", {
                    "logo_url": "",
                    "corporate_colors": {"primary": "", "secondary": ""},
                    "slogan": ""
                }),
                privacy_level=data.get("privacy_level", "")
            )
        print("Введите данные сотрудника:")
        full_name = input("Полное имя: ")
        position = input("Должность: ")
        company = input("Компания: ")
        department = input("Департамент: ")
        office_location = input("Местоположение офиса: ")
        
        print("\nВведите контактные данные:")
        email = input("Email: ")
        telegram = input("Telegram: ")
        
        print("\nВведите данные брендинга:")
        logo_url = input("URL логотипа: ")
        primary_color = input("Основной цвет (HEX): ")
        secondary_color = input("Вторичный цвет (HEX): ")
        slogan = input("Слоган: ")
        
        privacy_level = input("\nУровень конфиденциальности (low/medium/high): ")

        return cls(
            full_name=full_name,
            position=position,
            company=company,
            department=department,
            office_location=office_location,
            contact={"email": email, "telegram": telegram},
            branding={
                "logo_url": logo_url,
                "corporate_colors": {"primary": primary_color, "secondary": secondary_color},
                "slogan": slogan
            },
            privacy_level=privacy_level
        )

    @classmethod
    def from_json(cls, filename: str) -> 'Employee':
        """Создаёт экземпляр Employee из JSON-файла."""
        try:
            with open(filename, "r", encoding="utf-8") as file:
                data = json.load(file)
            if not isinstance(data, dict) or "employee" not in data:
                raise ValueError("Invalid JSON format: expected an object with 'employee' key")
            return cls.from_input(data["employee"])
        except FileNotFoundError:
            raise FileNotFoundError(f"File {filename} not found")
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON format in file")

    def get_low_info(self) -> Dict[str, str]:
        """Возвращает данные для уровня конфиденциальности 'low' (имя и должность)."""
        return {
            "full_name": self.get_full_name(),
            "position": self.get_position()
        }

    def get_medium_info(self) -> Dict[str, Any]:
        """Возвращает данные для уровня конфиденциальности 'medium' (имя, должность, компания, департамент, локация)."""
        return {
            "full_name": self.get_full_name(),
            "position": self.get_position(),
            "company": self.get_company(),
            "department": self.get_department(),
            "office_location": self.get_office_location()
        }

    def get_high_info(self) -> Dict[str, Any]:
        """Возвращает все данные для уровня конфиденциальности 'high'."""
        return asdict(self)

    def to_json(self) -> str:
        """Конвертирует объект Employee в JSON-строку с поддержкой UTF-8."""
        return json.dumps({"employee": asdict(self)}, ensure_ascii=False, indent=4)

    def save_to_json(self, filename: str) -> None:
        """Сохраняет объект Employee в JSON-файл."""
        with open(filename, "w", encoding="utf-8") as file:
            file.write(self.to_json())