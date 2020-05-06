export function objectToText(obj: any) {
  return JSON.stringify(obj);
}

export function textToObject(text: string) {
  try {
    const obj = JSON.parse(text);
    return obj;
  } catch (e) {
    console.warn("ObjectUtil#textToObject", text, e);
    return {};
  }
}
