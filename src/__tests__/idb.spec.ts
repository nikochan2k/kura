require("fake-indexeddb/auto");
import { FileSystemAsync } from "../FileSystemAsync";
import { IdbLocalFileSystemAsync } from "../idb/IdbLocalFileSystemAsync";
import { InvalidModificationError, NotFoundError } from "../FileError";

let fs: FileSystemAsync;
beforeAll(async () => {
  const factory = new IdbLocalFileSystemAsync("web-file-system-test");
  fs = await factory.requestFileSystemAsync(
    window.PERSISTENT,
    Number.MAX_VALUE
  );
});

test("add empty file", async done => {
  const fileEntry = await fs.root.getFile("empty.txt", {
    create: true,
    exclusive: true
  });
  expect(fileEntry.name).toBe("empty.txt");
  expect(fileEntry.fullPath).toBe("/empty.txt");
  expect(fileEntry.isDirectory).toBe(false);
  expect(fileEntry.isFile).toBe(true);
  done();
});

test("add text file", async done => {
  let fileEntry = await fs.root.getFile("test.txt", {
    create: true,
    exclusive: true
  });
  expect(fileEntry.name).toBe("test.txt");
  expect(fileEntry.fullPath).toBe("/test.txt");
  expect(fileEntry.isDirectory).toBe(false);
  expect(fileEntry.isFile).toBe(true);

  let writer = await fileEntry.createWriter();
  await writer.write(new Blob(["hoge"], { type: "text/plain" }));
  expect(writer.position).toBe(4);
  let file = await fileEntry.file();
  expect(file.size).toBe(4);

  await writer.write(new Blob(["fuga"], { type: "text/plain" }));
  expect(writer.position).toBe(8);
  file = await fileEntry.file();
  expect(file.size).toBe(8);

  try {
    fileEntry = await fs.root.getFile("test.txt", {
      create: true,
      exclusive: true
    });
    fail();
  } catch (e) {}
  fileEntry = await fs.root.getFile("test.txt");
  file = await fileEntry.file();
  expect(file.size).toBe(8);

  const str = await new Promise<string>(resolve => {
    const reader = new FileReader();
    reader.addEventListener("loadend", e => {
      const text = (e.srcElement as any).result;
      resolve(text);
    });
    reader.readAsText(file);
  });
  expect(str).toBe("hogefuga");

  done();
});

test("create dir", async done => {
  const dirEntry = await fs.root.getDirectory("folder", {
    create: true,
    exclusive: true
  });
  expect(dirEntry.isFile).toBe(false);
  expect(dirEntry.isDirectory).toBe(true);
  expect(dirEntry.name).toBe("folder");

  done();
});

test("create file in the dir", async done => {
  const dirEntry = await fs.root.getDirectory("folder");
  const fileEntry = await dirEntry.getFile("in.txt", {
    create: true,
    exclusive: true
  });
  expect(fileEntry.fullPath).toBe("/folder/in.txt");
  try {
    await dirEntry.getFile("out.txt");
    fail();
  } catch (e) {
    expect(e).toBeInstanceOf(NotFoundError);
  }

  done();
});

test("readdir", async done => {
  const reader = fs.root.createReader();
  const entries = await reader.readEntries();
  let names = ["empty.txt", "test.txt", "folder"];
  for (const entry of entries) {
    names = names.filter(name => name !== entry.name);
  }
  expect(names.length).toBe(0);

  done();
});

test("remove a file", async done => {
  const entry = await fs.root.getFile("empty.txt");
  await entry.remove();
  try {
    await fs.root.getFile("empty.txt");
    fail();
  } catch (e) {
    expect(e).toBeInstanceOf(NotFoundError);
  }

  const reader = fs.root.createReader();
  const entries = await reader.readEntries();
  let names = ["test.txt", "folder"];
  for (const entry of entries) {
    names = names.filter(name => name !== entry.name);
  }
  expect(names.length).toBe(0);

  done();
});

test("remove a not empty folder", async done => {
  const entry = await fs.root.getDirectory("folder");
  try {
    await entry.remove();
    fail();
  } catch (e) {
    expect(e).toBeInstanceOf(InvalidModificationError);
  }

  done();
});

test("remove recursively", async done => {
  await fs.root.removeRecursively();

  const reader = fs.root.createReader();
  const entries = await reader.readEntries();
  expect(entries.length).toBe(0);

  done();
});
