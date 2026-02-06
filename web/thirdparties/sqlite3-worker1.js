const worker = /** @type {DedicatedWorkerGlobalScope} */ (
  /** @type {any} mandatory 'any' workaround */
  (globalThis)
);

function dateNow() {
  return Date.now();
}

const sqlite3WasmBinSize = 8388608;
const sqlite3WasmPageSize = Math.ceil(sqlite3WasmBinSize / (2 ** 16));
const sqlite3WasmImports = {
  memory: new WebAssembly.Memory({ initial: sqlite3WasmPageSize, maximum: 2 ** 15 }),
  emscripten_date_now: dateNow,
  emscripten_get_now() { return performance.now(); },
  emscripten_get_heap_max() { return 2147483648; },
  emscripten_resize_heap(requestedSize) {
    console.debug('emscripten_resize_heap', requestedSize);
  },
  environ_get(__environ, environ_buf) {
    console.debug('environ_get', __environ, environ_buf);
    return 0;
  },
  environ_sizes_get(penviron_count, penviron_buf_size) {
    console.debug('environ_sizes_get', penviron_count >> 2, penviron_buf_size >> 2);
    return 0;
  },
  clock_time_get(clk_id, ignored_precision, ptime) {
    console.debug('clock_time_get', clk_id, ignored_precision, ptime);
  },
  _tzset_js(timezone, daylight, std_name, dst_name) {
    console.debug('_tzset_js', timezone, daylight, std_name, dst_name);
  },
  _localtime_js(time, tmPtr) {
    console.debug('_localtime_js', time, tmPtr);
  },
  _munmap_js(addr, len, prot, flags, fd, offset) {
    console.debug('_munmap_js', addr, len, prot, flags, fd, offset);
  },
  _mmap_js(len, prot, flags, fd, offset, allocated, addr) {
    console.debug('_mmap_js', len, prot, flags, fd, offset, allocated, addr);
  },
  __syscall_faccessat(dirfd, path, amode, flags) {
    console.debug('__syscall_faccessat', dirfd, path, amode, flags);
  },
  __syscall_chmod(path, mode) {
    console.debug('__syscall_chmod', path, mode);
  },
  __syscall_getcwd(buf, size) {
    console.debug('__syscall_getcwd', buf, size);
  },
  __syscall_fchown32(fd, owner, group) {
    console.debug('__syscall_chmod', fd, owner, group);
  },
  __syscall_fcntl64(fd, cmd, varargs) {
    console.debug('__syscall_fcntl64', fd, cmd, varargs);
  },
  __syscall_fchmod(fd, mode) {
    console.debug('__syscall_fchmod', fd, mode);
  },
  __syscall_fstat64(fd, buf) {
    console.debug('__syscall_fstat64', fd, buf);
  },
  __syscall_ftruncate64(fd, length) {
    console.debug('__syscall_ftruncate64', fd, length);
  },
  __syscall_newfstatat(dirfd, path, buf, flags) {
    console.debug('__syscall_newfstatat', dirfd, path, buf, flags);
  },
  __syscall_lstat64(path, buf) {
    console.debug('__syscall_lstat64', path, buf);
  },
  __syscall_openat(dirfd, path, flags, varargs) {
    console.debug('__syscall_openat', dirfd, path, flags, varargs);
  },
  __syscall_ioctl(fd, op, varargs) {
    console.debug('__syscall_ioctl', fd, op, varargs);
  },
  __syscall_stat64(path, buf) {
    console.debug('__syscall_stat64', path, buf);
  },
  __syscall_mkdirat(dirfd, path, mode) {
    console.debug('__syscall_mkdirat', dirfd, path, mode);
  },
  __syscall_readlinkat(dirfd, path, buf, bufsize) {
    console.debug('__syscall_readlinkat', dirfd, path, buf, bufsize);
  },
  __syscall_rmdir(path) {
    console.debug('__syscall_rmdir', path);
  },
  __syscall_unlinkat(dirfd, path, flags) {
    console.debug('__syscall_unlinkat', dirfd, path, flags);
  },
  __syscall_utimensat(dirfd, path, times, flags) {
    console.debug('__syscall_utimensat', dirfd, path, times, flags);
  },
  fd_fdstat_get(fd, pbuf) {
    console.debug('fd_fdstat_get', fd, pbuf);
  },
  fd_read(fd, iov, iovcnt, pnum) {
    console.debug('fd_read', fd, iov, iovcnt, pnum);
  },
  fd_write(fd, iov, iovcnt, pnum) {
    console.debug('fd_write', fd, iov, iovcnt, pnum);
  },
  fd_close(fd) {
    console.debug('fd_close', fd);
  },
  fd_seek(fd, offset, whence, newOffset) {
    console.debug('fd_seek', fd, offset, whence, newOffset);
  },
  fd_sync(fd) {
    console.debug('fd_sync', fd);
  },
};

const sqlite3WasmUrl = new URL('./npm/@sqlite.org/sqlite-wasm@3.51.2-build6/dist/sqlite3.wasm', import.meta.url);
const sqlite3WasmResponse = fetch(sqlite3WasmUrl, { credentials: "same-origin" });
const sqlite3Wasm = await WebAssembly.instantiateStreaming(sqlite3WasmResponse, {
  env: sqlite3WasmImports,
  wasi_snapshot_preview1: sqlite3WasmImports,
});

const sqlite3WasmExports = /** @type {any} */ (sqlite3Wasm.instance.exports);

console.debug(Object.keys(sqlite3WasmExports));
console.debug(sqlite3WasmExports.__wasm_call_ctors());
console.debug(sqlite3WasmExports.sqlite3_open);
console.debug(sqlite3WasmExports.randomasdasd);

worker.addEventListener('message', function sqlite3WorkerInBound(event) {
  console.debug('worker', 'sqlite3WorkerInBound', event.data);
});

worker.postMessage({
  type: 'sqlite3-api',
  result: 'worker1-ready',
});
