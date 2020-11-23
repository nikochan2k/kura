export function objectToText(obj: any) {
  return JSON.stringify(obj);
}

export function textToObject<T>(text: string) {
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.warn("ObjectUtil#textToObject", text, e);
    return {} as T;
  }
}

export function deepCopy<T>(obj: T) {
  return JSON.parse(JSON.stringify(obj)) as T;
}
