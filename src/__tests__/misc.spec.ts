import "../polyfill";
import {
  getParentPath,
  getName,
  normalizePath,
  getExtension,
  getBaseName,
  isIllegalFileName,
} from "../FileSystemUtil";

test("FileSystemUtil#getParentPath", () => {
  let parentPath = getParentPath("/hoge/fuga");
  expect(parentPath).toBe("/hoge");
  parentPath = getParentPath("/hoge/fuga/");
  expect(parentPath).toBe("/hoge");
  parentPath = getParentPath("/");
  expect(parentPath).toBe("/");
  parentPath = getParentPath("hoge");
  expect(parentPath).toBe("hoge");
  parentPath = getParentPath("");
  expect(parentPath).toBe("/");
});

test("FileSystemUtil#getName", () => {
  let name = getName("/hoge/fuga");
  expect(name).toBe("fuga");
  name = getName("hoge/fuga");
  expect(name).toBe("fuga");
  name = getName("/hoge/fuga/");
  expect(name).toBe("fuga");
  name = getName("/");
  expect(name).toBe("");
  name = getName("test");
  expect(name).toBe("test");
});

test("FileSystemUtil#getExtension", () => {
  let extension = getExtension("/hoge/fuga.txt");
  expect(extension).toBe("txt");
  extension = getExtension("hoge/fuga.txt");
  expect(extension).toBe("txt");
  extension = getExtension("fuga.txt");
  expect(extension).toBe("txt");
  extension = getExtension("fuga");
  expect(extension).toBe("");
  extension = getExtension("/");
  expect(extension).toBe("");
  extension = getExtension("");
  expect(extension).toBe("");
  extension = getExtension(".txt");
  expect(extension).toBe(".txt");
});

test("FileSystemUtil#getBaseName", () => {
  let baseName = getBaseName("/hoge/fuga.txt");
  expect(baseName).toBe("fuga");
  baseName = getBaseName("/hoge/.fuga.txt");
  expect(baseName).toBe(".fuga");
  baseName = getBaseName("/hoge/foo.bar.txt");
  expect(baseName).toBe("foo.bar");
  baseName = getBaseName("/hoge/fuga");
  expect(baseName).toBe("fuga");
  baseName = getBaseName("fuga");
  expect(baseName).toBe("fuga");
  baseName = getBaseName("/");
  expect(baseName).toBe("");
  baseName = getBaseName("");
  expect(baseName).toBe("");
  baseName = getBaseName(".txt");
  expect(baseName).toBe(".txt");
  baseName = getBaseName(".fuga.txt");
  expect(baseName).toBe(".fuga");
});

test("FileSystemUtil#normalizePath", () => {
  let path = normalizePath("/hoge/fuga");
  expect(path).toBe("/hoge/fuga");
  path = normalizePath("/hoge//fuga/");
  expect(path).toBe("/hoge/fuga");
  path = normalizePath("/hoge/fuga/");
  expect(path).toBe("/hoge/fuga");
  path = normalizePath("./hoge/fuga/");
  expect(path).toBe("/hoge/fuga");
  path = normalizePath("/hoge/../fuga/");
  expect(path).toBe("/fuga");
  path = normalizePath("/");
  expect(path).toBe("/");
  path = normalizePath("");
  expect(path).toBe("/");
});

test("FileSystemUtil#isIllegalFileName", () => {
  let result = isIllegalFileName("fuga");
  expect(result).toBe(false);
  result = isIllegalFileName("<test>");
  expect(result).toBe(true);
  result = isIllegalFileName("\\test");
  expect(result).toBe(true);
  result = isIllegalFileName(":test");
  expect(result).toBe(true);
  result = isIllegalFileName("\ttest");
  expect(result).toBe(true);
});
