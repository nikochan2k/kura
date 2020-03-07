import { getParentPath, getName, normalizePath } from "../FileSystemUtil";

test("FileSystemUtil#getParentPath", () => {
  let parentPath = getParentPath("/hoge/fuga");
  expect(parentPath).toBe("/hoge");
  parentPath = getParentPath("/");
  expect(parentPath).toBe("/");
});

test("FileSystemUtil#getName", () => {
  let name = getName("/hoge/fuga");
  expect(name).toBe("fuga");
  name = getName("/");
  expect(name).toBe("");
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
});
