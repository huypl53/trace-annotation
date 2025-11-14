import { ImageXmlPair } from '../models/types';

/**
 * Gets the base name of a file without extension
 */
function getBaseName(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
}

/**
 * Checks if a file is an image file
 */
function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Checks if a file is an XML file
 */
function isXmlFile(file: File): boolean {
  return file.type === 'text/xml' || file.name.toLowerCase().endsWith('.xml');
}

/**
 * Pairs image files with XML files based on matching base names
 * Returns an array of ImageXmlPair objects
 */
export function pairImageXmlFiles(files: File[]): ImageXmlPair[] {
  const imageFiles: File[] = [];
  const xmlFiles: File[] = [];

  // Separate images and XMLs
  files.forEach(file => {
    if (isImageFile(file)) {
      imageFiles.push(file);
    } else if (isXmlFile(file)) {
      xmlFiles.push(file);
    }
  });

  // Create a map of XML files by base name
  const xmlMap = new Map<string, File>();
  xmlFiles.forEach(xmlFile => {
    const baseName = getBaseName(xmlFile.name);
    xmlMap.set(baseName.toLowerCase(), xmlFile);
  });

  // Pair images with XMLs
  const timestamp = Date.now();
  const pairs: ImageXmlPair[] = imageFiles.map((imageFile, index) => {
    const baseName = getBaseName(imageFile.name);
    const matchingXml = xmlMap.get(baseName.toLowerCase()) || null;
    const imageUrl = URL.createObjectURL(imageFile);

    return {
      id: `pair-${timestamp}-${index}`,
      imageFile,
      xmlFile: matchingXml,
      imageUrl,
    };
  });

  // Create pairs for unmatched XML files (orphan XMLs)
  const matchedXmlBaseNames = new Set(
    pairs
      .filter(p => p.xmlFile)
      .map(p => getBaseName(p.xmlFile!.name).toLowerCase())
  );

  xmlFiles.forEach((xmlFile, index) => {
    const baseName = getBaseName(xmlFile.name);
    if (!matchedXmlBaseNames.has(baseName.toLowerCase())) {
      // Create a placeholder pair for orphan XML
      pairs.push({
        id: `pair-${timestamp}-xml-${index}`,
        imageFile: new File([], `${baseName}.png`, { type: 'image/png' }),
        xmlFile: xmlFile,
        imageUrl: '', // No image URL for orphan XMLs
      });
    }
  });

  return pairs;
}

