import { DirectoryEntryAsync } from "../DirectoryEntryAsync";
import {
  InvalidModificationError,
  NotFoundError,
  PathExistsError,
} from "../FileError";
import { FileSystemAsync } from "../FileSystemAsync";
import { LocalFileSystemAsync } from "../LocalFileSystemAsync";
import { toText } from "../TextConverter";

const globalVar =
  typeof window !== "undefined"
    ? window
    : typeof global !== "undefined"
    ? global
    : Function("return this;")();

if (!globalVar.setTimeout || !globalVar.clearTimeout) {
  const timers = require("timers");
  globalVar.clearTimeout = timers.clearTimeout;
  globalVar.setTimeout = timers.setTimeout;
}

export function testAll(
  factory: LocalFileSystemAsync,
  prepare?: () => Promise<void>,
  ignoreDirectoryNotFound = false
) {
  let fs: FileSystemAsync;
  beforeAll(async () => {
    if (prepare) {
      await prepare();
    }
    fs = await factory.requestFileSystemAsync(
      window.PERSISTENT,
      Number.MAX_VALUE
    );
  });

  test("add empty file", async (done) => {
    try {
      const fileEntry = await fs.root.getFile("empty.txt", {
        create: true,
        exclusive: true,
      });
      expect(fileEntry.name).toBe("empty.txt");
      expect(fileEntry.fullPath).toBe("/empty.txt");
      expect(fileEntry.isDirectory).toBe(false);
      expect(fileEntry.isFile).toBe(true);
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("add text file", async (done) => {
    try {
      let fileEntry = await fs.root.getFile("test.txt", {
        create: true,
        exclusive: true,
      });
      expect(fileEntry.name).toBe("test.txt");
      expect(fileEntry.fullPath).toBe("/test.txt");
      expect(fileEntry.isDirectory).toBe(false);
      expect(fileEntry.isFile).toBe(true);

      await fileEntry.writeFile(new Blob(["hoge"], { type: "text/plain" }));
      let file = await fileEntry.file();
      expect(file.size).toBe(4);

      const writer = await fileEntry.createWriter();
      writer.seek(4);
      await writer.write(new Blob(["ふが"], { type: "text/plain" }));
      expect(writer.position).toBe(10);
      file = await fileEntry.file();
      expect(file.size).toBe(10);

      try {
        fileEntry = await fs.root.getFile("test.txt", {
          create: true,
          exclusive: true,
        });
        fail(`"${fileEntry.fullPath}" has created`);
      } catch (e) {
        expect(e).toBeInstanceOf(PathExistsError);
      }
      fileEntry = await fs.root.getFile("test.txt");
      file = await fileEntry.file();
      expect(file.size).toBe(10);

      const str = await toText(file);
      expect(str).toBe("hogeふが");
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("create dir", async (done) => {
    try {
      const dirEntry = await fs.root.getDirectory("folder", {
        create: true,
        exclusive: true,
      });
      expect(dirEntry.isFile).toBe(false);
      expect(dirEntry.isDirectory).toBe(true);
      expect(dirEntry.name).toBe("folder");
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("create file in the dir", async (done) => {
    try {
      const dirEntry = await fs.root.getDirectory("folder");
      const fileEntry = await dirEntry.getFile("in.txt", {
        create: true,
        exclusive: true,
      });
      expect(fileEntry.fullPath).toBe("/folder/in.txt");
      try {
        await dirEntry.getFile("out.txt");
        fail(`"/folder/out.txt" has existed`);
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundError);
      }

      const parent = await fileEntry.getParent();
      expect(parent.fullPath).toBe(dirEntry.fullPath);
      expect(parent.name).toBe(dirEntry.name);
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("readdir", async (done) => {
    try {
      const reader = fs.root.createReader();
      const entries = await reader.readEntries();
      let names = ["empty.txt", "test.txt", "folder"];
      for (const entry of entries) {
        names = names.filter((name) => name !== entry.name);
      }
      expect(names.length).toBe(0);
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("copy file", async (done) => {
    try {
      const test = await fs.root.getFile("test.txt");
      const testMeta = await test.getMetadata();
      const parent = await test.getParent();
      await test.copyTo(parent, "test2.txt");
      const test2 = await fs.root.getFile("test2.txt");
      const test2Meta = await test2.getMetadata();
      expect(test2Meta.size).toBe(testMeta.size);

      const reader = fs.root.createReader();
      const entries = await reader.readEntries();
      let names = ["empty.txt", "test.txt", "test2.txt", "folder"];
      for (const entry of entries) {
        names = names.filter((name) => name !== entry.name);
      }
      expect(names.length).toBe(0);
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("copy folder", async (done) => {
    try {
      const folder = await fs.root.getDirectory("folder");
      const parent = await folder.getParent();
      const folder1 = (await folder.copyTo(
        parent,
        "folder1"
      )) as DirectoryEntryAsync;

      let reader = fs.root.createReader();
      let entries = await reader.readEntries();
      let names = ["empty.txt", "test.txt", "test2.txt", "folder", "folder1"];
      for (const entry of entries) {
        names = names.filter((name) => name !== entry.name);
      }
      expect(names.length).toBe(0);

      reader = folder1.createReader();
      entries = await reader.readEntries();
      names = ["in.txt"];
      for (const entry of entries) {
        names = names.filter((name) => name !== entry.name);
      }
      expect(names.length).toBe(0);
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("move folder", async (done) => {
    try {
      const folder = await fs.root.getDirectory("folder");
      const parent = await folder.getParent();
      const folder2 = (await folder.moveTo(
        parent,
        "folder2"
      )) as DirectoryEntryAsync;

      let reader = fs.root.createReader();
      let entries = await reader.readEntries();
      let names = ["empty.txt", "test.txt", "test2.txt", "folder1", "folder2"];
      for (const entry of entries) {
        names = names.filter((name) => name !== entry.name);
      }
      expect(names.length).toBe(0);

      reader = folder2.createReader();
      entries = await reader.readEntries();
      names = ["in.txt"];
      for (const entry of entries) {
        names = names.filter((name) => name !== entry.name);
      }
      expect(names.length).toBe(0);
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("remove a file", async (done) => {
    try {
      const entry = await fs.root.getFile("empty.txt");
      await entry.remove();
      try {
        await fs.root.getFile("empty.txt");
        fail(`"${entry.fullPath}" has not been deleted`);
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundError);
      }

      const reader = fs.root.createReader();
      const entries = await reader.readEntries();
      let names = ["test.txt", "test2.txt", "folder1", "folder2"];
      for (const entry of entries) {
        names = names.filter((name) => name !== entry.name);
      }
      expect(names.length).toBe(0);
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("remove a not empty folder", async (done) => {
    try {
      const entry = await fs.root.getDirectory("folder2");
      try {
        await entry.remove();
        fail(`"${entry.fullPath}" has deleted`);
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidModificationError);
      }
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("remove recursively", async (done) => {
    try {
      await fs.root.removeRecursively();
      const reader = fs.root.createReader();
      const entries = await reader.readEntries();
      expect(entries.length).toBe(0);
    } catch (e) {
      fail(e);
    } finally {
      done();
    }
  });

  test("get removed folder", async (done) => {
    try {
      await fs.root.getDirectory("folder1");
      if (!ignoreDirectoryNotFound) {
        fail(`"/folder1" has existed`);
      }
    } catch (e) {
      if (ignoreDirectoryNotFound) {
        fail(e);
      } else {
        expect(e).toBeInstanceOf(NotFoundError);
      }
    } finally {
      done();
    }
  });
}
