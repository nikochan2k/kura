export function objectToText(obj: any) {
  return JSON.stringify(obj);
}

export function textToObject<T>(text: string) {
  if (!text) {
    console.warn("ObjectUtil#textToObject", "No input");
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.warn("ObjectUtil#textToObject", text, e);
    return null;
  }
}

export function deepCopy<T>(obj: T) {
  return JSON.parse(JSON.stringify(obj)) as T;
}
