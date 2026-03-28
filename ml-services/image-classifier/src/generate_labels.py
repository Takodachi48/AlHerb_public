#!/usr/bin/env python3
"""
Script to generate herb labels file based on NUM_CLASSES configuration.
This ensures consistency between model architecture and labels.
"""

import json
from pathlib import Path
from app.core.config import settings

def generate_labels_file():
    """Generate herb labels file based on NUM_CLASSES setting"""
    
    # Full herb mapping (40 classes)
    full_herb_mapping = {
        "0": {"herb_name": "Calamansi", "scientific_name": "Citrus microcarpa"},
        "1": {"herb_name": "Sili", "scientific_name": "Capsicum frutescens"},
        "2": {"herb_name": "Suha", "scientific_name": "Citrus maxima"},
        "3": {"herb_name": "Saluyot", "scientific_name": "Corchorus olitorius"},
        "4": {"herb_name": "Tuba-tuba", "scientific_name": "Jatropha curcas"},
        "5": {"herb_name": "Mangga", "scientific_name": "Mangifera indica"},
        "6": {"herb_name": "Kamoteng Kahoy", "scientific_name": "Manihot esculenta"},
        "7": {"herb_name": "Malunggay", "scientific_name": "Moringa oleifera"},
        "8": {"herb_name": "Oregano", "scientific_name": "Origanum vulgare"},
        "9": {"herb_name": "Ulasimang-bato", "scientific_name": "Peperomia pellucida"},
        "10": {"herb_name": "Gumamela", "scientific_name": "Hibiscus rosa-sinensis"},
        "11": {"herb_name": "Bignay", "scientific_name": "Antidesma bunius"},
        "12": {"herb_name": "Bayabas", "scientific_name": "Psidium guajava"},
        "13": {"herb_name": "Lagundi", "scientific_name": "Vitex negundo"},
        "14": {"herb_name": "Sambong", "scientific_name": "Blumea balsamifera"},
        "15": {"herb_name": "Takip-kuhol", "scientific_name": "Centella asiatica"},
        "16": {"herb_name": "Mayana", "scientific_name": "Coleus scutellarioides"},
        "17": {"herb_name": "Sampa-sampalukan", "scientific_name": "Phyllanthus niruri"},
        "18": {"herb_name": "Ampalaya", "scientific_name": "Momordica charantia"},
        "19": {"herb_name": "Tawa-tawa", "scientific_name": "Euphorbia hirta"},
        "20": {"herb_name": "Luyang Dilaw", "scientific_name": "Curcuma longa"},
        "21": {"herb_name": "Tsaa-tsaa", "scientific_name": "Carmona retusa"},
        "22": {"herb_name": "Akapulko", "scientific_name": "Senna alata"},
        "23": {"herb_name": "Yerba Buena", "scientific_name": "Mentha cordifolia"},
        "24": {"herb_name": "Balanoy", "scientific_name": "Ocimum basilicum"},
        "25": {"herb_name": "Adelfa", "scientific_name": "Nerium oleander"},
        "26": {"herb_name": "Pandan", "scientific_name": "Pandanus amaryllifolius"},
        "27": {"herb_name": "Aloe Vera", "scientific_name": "Aloe barbadensis Miller"},
        "28": {"herb_name": "Banaba", "scientific_name": "Lagerstroemia speciosa"},
        "29": {"herb_name": "Kamias", "scientific_name": "Averrhoa bilimbi"},
        "30": {"herb_name": "Guyabano", "scientific_name": "Annona muricata"},
        "31": {"herb_name": "Dayap", "scientific_name": "Citrus aurantiifolia"},
        "32": {"herb_name": "Alagaw", "scientific_name": "Premna odorata"},
        "33": {"herb_name": "Kakawate", "scientific_name": "Gliricidia sepium"},
        "34": {"herb_name": "Kahel", "scientific_name": "Citrus sinensis"},
        "35": {"herb_name": "Kamantigi", "scientific_name": "Impatiens balsamina"},
        "36": {"herb_name": "Mani", "scientific_name": "Arachis hypogaea"},
        "37": {"herb_name": "Sampalok", "scientific_name": "Tamarindus indica"},
        "38": {"herb_name": "Ipil-ipil", "scientific_name": "Leucaena leucocephala"},
        "39": {"herb_name": "Kamote", "scientific_name": "Ipomoea batatas"}
    }
    
    # Special mapping for 3-class model (user's trained herbs)
    three_class_mapping = {
        "0": {"herb_name": "Sili", "scientific_name": "Capsicum frutescens"},
        "1": {"herb_name": "Calamansi", "scientific_name": "Citrus microcarpa"},
        "2": {"herb_name": "Kamoteng Kahoy", "scientific_name": "Manihot esculenta"}
    }
    
    # Get the number of classes from settings
    num_classes = settings.NUM_CLASSES
    
    # Create subset based on NUM_CLASSES
    if num_classes == 3:
        subset_mapping = three_class_mapping
    else:
        subset_mapping = {}
        for i in range(num_classes):
            if str(i) in full_herb_mapping:
                subset_mapping[str(i)] = full_herb_mapping[str(i)]
            else:
                print(f"Warning: No herb mapping found for class {i}")
    
    # Generate the labels file path dynamically
    labels_file = Path(settings.LABELS_PATH)
    labels_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Write the subset to file
    with labels_file.open('w', encoding='utf-8') as f:
        json.dump(subset_mapping, f, indent=2, ensure_ascii=False)
    
    print(f"Generated {labels_file.as_posix()} with {num_classes} classes")
    print(f"Classes: {list(subset_mapping.keys())}")
    
    return labels_file.as_posix()

if __name__ == "__main__":
    generate_labels_file()
