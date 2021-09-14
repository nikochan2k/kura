export function objectToText(obj: any) {
  return JSON.stringify(obj);
}

export function textToObject<T>(text: string) {
  if (!text) {
    throw new Error("ObjectUtil#textToObject: No input");
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error("ObjectUtil#textToObject: " + text + "\n" + text);
  }
}

export function deepCopy<T>(obj: T) {
  return JSON.parse(JSON.stringify(obj)) as T;
}
