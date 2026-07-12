---
title: Python 异步编程 async/await 深入理解
date: 2026-07-12 18:59:27
tags:
  - Python
  - 异步编程
  - asyncio
  - async/await
categories:
  - Python
description: 深入理解 Python async/await 异步编程模型，涵盖事件循环、协程、asyncio 核心 API、实用模式以及与多线程的对比。
---

## 同步 vs 异步：一个直观的例子

假设你需要从 10 个不同的 API 获取数据，每个请求耗时 200ms：

```python
import time
import requests

def fetch_sync():
    results = []
    for i in range(10):
        resp = requests.get(f"https://httpbin.org/delay/0.2")
        results.append(resp.json())
    return results

start = time.time()
fetch_sync()
print(f"同步耗时: {time.time() - start:.2f}s")  # 大约 2.0s
```

等一个请求返回再发下一个，10 个请求串行执行。换成异步：

```python
import asyncio
import aiohttp

async def fetch_async():
    async with aiohttp.ClientSession() as session:
        tasks = [
            session.get("https://httpbin.org/delay/0.2")
            for _ in range(10)
        ]
        responses = await asyncio.gather(*tasks)
        results = [await r.json() for r in responses]
        return results

start = time.time()
asyncio.run(fetch_async())
print(f"异步耗时: {time.time() - start:.2f}s")  # 大约 0.2s
```

10 个请求并发发出，总耗时接近单个请求的时间——这就是异步的核心价值：**在等待 I/O 时让出控制权，让其他任务继续执行**。

## 事件循环：异步的心脏

事件循环（Event Loop）是 asyncio 的核心调度器。它的工作方式可以用伪代码表达：

```python
# 事件循环的简化模型（非真实源码，仅用于理解）
while tasks:
    for task in tasks:
        if task.is_ready():
            run_one_step(task)
        elif task.is_waiting_for_io():
            # 注册 I/O 就绪回调，当前不阻塞
            register_io_callback(task)
```

真正的事件循环使用操作系统层面的 I/O 多路复用（Linux 用 `epoll`，macOS 用 `kqueue`，Windows 用 `IOCP`）。当你 `await` 一个 I/O 操作时，当前协程被挂起，事件循环去执行其他协程。I/O 就绪后，挂起的协程被恢复执行。

关键理解：**Python 的 async/await 是单线程模型**。所有协程在同一个线程中运行，由事件循环调度。不是真正的并行，而是 I/O 等待时的并发。

## 协程与 async/await 语法

### 定义一个协程

```python
# async def 定义的函数返回 coroutine object，不是普通的函数对象
async def my_coroutine():
    print("start")
    await asyncio.sleep(1)  # await 一个 awaitable 对象
    print("end")
    return "done"

# 调用协程函数不会执行它，而是返回 coroutine object
coro = my_coroutine()
print(type(coro))  # <class 'coroutine'>

# 需要用 asyncio.run() 来执行
result = asyncio.run(coro)
print(result)  # "done"
```

### await 后面可以放什么

`await` 后面必须是 **awaitable 对象**，满足以下之一：

1. **coroutine object**：`async def` 函数的返回值
2. **Task**：`asyncio.create_task()` 的返回值，封装了一个被调度的协程
3. **Future**：低层级对象，表示一个尚未完成的操作

大多数时候你 `await` 的是协程或 Task。第三方库（如 aiohttp）会返回自定义的 awaitable 对象。

### asyncio.run() 的正确用法

```python
# asyncio.run() 创建一个新的事件循环，运行协程，然后关闭循环
# 每个线程只能有一个正在运行的事件循环
# 不要在已经运行的事件循环中再调用 asyncio.run()

async def main():
    # 所有异步逻辑写在这里
    return await do_work()

# 入口点：一次调用
result = asyncio.run(main())
```

## asyncio 核心 API 与常用模式

### asyncio.gather：并发运行多个协程

```python
async def fetch_url(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            return await resp.text()

async def main():
    urls = [
        "https://httpbin.org/get",
        "https://httpbin.org/headers",
        "https://httpbin.org/ip",
    ]
    # gather 并发运行，返回结果列表（保持顺序）
    results = await asyncio.gather(
        fetch_url(urls[0]),
        fetch_url(urls[1]),
        fetch_url(urls[2]),
        return_exceptions=True  # 单个任务失败不影响其他任务
    )
    for url, result in zip(urls, results):
        if isinstance(result, Exception):
            print(f"{url} failed: {result}")
        else:
            print(f"{url}: {len(result)} bytes")
```

### asyncio.create_task：后台任务

```python
async def background_task(name, delay):
    await asyncio.sleep(delay)
    print(f"{name} done after {delay}s")

async def main():
    # create_task 立即调度协程，返回 Task 对象
    task1 = asyncio.create_task(background_task("A", 2))
    task2 = asyncio.create_task(background_task("B", 1))

    print("Tasks started, doing other things...")
    await asyncio.sleep(0.5)
    print("Still working...")

    # 等待所有任务完成
    await task1
    await task2

# 输出顺序：
# Tasks started, doing other things...
# Still working...
# B done after 1s
# A done after 2s
```

Task 和 gather 的区别：
- `gather`：阻塞等待一组协程全部完成，返回汇总结果
- `create_task`：非阻塞调度，返回 Task 可稍后 await，适合需要"发出后不管"或"中途取消"的场景

### asyncio.wait_for：超时控制

```python
async def slow_operation():
    await asyncio.sleep(10)
    return "done"

async def main():
    try:
        result = await asyncio.wait_for(slow_operation(), timeout=3.0)
    except asyncio.TimeoutError:
        print("操作超时！执行降级逻辑")
        result = "fallback"
    return result
```

### 取消任务

```python
async def main():
    task = asyncio.create_task(slow_operation())
    await asyncio.sleep(1)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("Task was cancelled")

    # 优雅取消需要协程内部配合 -- 在 await 处才会触发 CancelledError
```

### asyncio.Queue：协程间通信

```python
async def producer(queue: asyncio.Queue):
    for i in range(5):
        await asyncio.sleep(0.5)  # 模拟生产耗时
        await queue.put(f"item-{i}")
        print(f"Produced item-{i}")

async def consumer(queue: asyncio.Queue):
    while True:
        item = await queue.get()
        print(f"Consumed {item}")
        # 处理 item...
        queue.task_done()

async def main():
    queue = asyncio.Queue(maxsize=3)  # 有界队列，生产者满时自动等待
    prod = asyncio.create_task(producer(queue))
    cons = asyncio.create_task(consumer(queue))
    await prod
    await queue.join()  # 等待所有 item 被处理完
    cons.cancel()
```

## 实战：异步网页爬虫

```python
import asyncio
import aiohttp
from bs4 import BeautifulSoup
import time

class AsyncCrawler:
    def __init__(self, concurrency=5):
        self.concurrency = concurrency
        self.semaphore = asyncio.Semaphore(concurrency)
        self.results = {}

    async def fetch_page(self, session: aiohttp.ClientSession, url: str):
        """带限流控制的异步抓取"""
        async with self.semaphore:
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        return await resp.text()
                    else:
                        print(f"HTTP {resp.status} for {url}")
                        return None
            except asyncio.TimeoutError:
                print(f"Timeout for {url}")
                return None
            except aiohttp.ClientError as e:
                print(f"Error fetching {url}: {e}")
                return None

    async def parse(self, url: str, html: str) -> dict:
        """解析页面（CPU 密集操作，这里仅为示例）"""
        soup = BeautifulSoup(html, 'html.parser')
        title = soup.title.string if soup.title else "No title"
        links = len(soup.find_all('a'))
        return {"url": url, "title": title, "links": links}

    async def crawl_one(self, session, url: str):
        html = await self.fetch_page(session, url)
        if html:
            return await self.parse(url, html)
        return None

    async def crawl(self, urls: list[str]):
        async with aiohttp.ClientSession(
            headers={"User-Agent": "AsyncCrawler/1.0"}
        ) as session:
            tasks = [self.crawl_one(session, url) for url in urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        for url, result in zip(urls, results):
            if isinstance(result, Exception):
                print(f"Failed: {url} -> {result}")
            elif result:
                self.results[url] = result

        return self.results

# 使用
async def main():
    urls = [f"https://httpbin.org/links/{n}/0" for n in range(10)]
    crawler = AsyncCrawler(concurrency=5)
    results = await crawler.crawl(urls)
    for url, data in results.items():
        print(f"{url}: '{data['title']}', {data['links']} links")
```

Semaphore 是关键：控制并发数，避免对目标服务器造成过大压力或被 IP 封禁。

## 异步 vs 多线程：如何选择

| 维度 | async/await | threading |
|------|-------------|-----------|
| 并发模型 | 协程，单线程 | 多线程，可并行 |
| 适合场景 | I/O 密集型（网络、文件、数据库） | CPU 密集型 |
| GIL 影响 | 不受影响（单线程） | 受 GIL 限制（CPU 任务无加速） |
| 内存开销 | 极低（一个协程约 1KB） | 较高（一个线程约 8MB 栈） |
| 上下文切换 | 用户态，极快 | 内核态，较慢 |
| 调试难度 | 一般（单线程，顺序可追踪） | 较高（竞态条件难复现） |
| 典型生态 | aiohttp, asyncpg, fastapi | requests, psycopg2, django |

**判定法则：**

- 你的代码大部分时间在等待网络/磁盘/数据库？用 async/await
- 你的代码在做大量数学运算、图像处理？用多进程（`multiprocessing`），不是线程
- 需要在现有同步框架（Django）中加入异步能力？看看有没有 async view 支持，没有的话用线程池作为过渡

## 常见坑

### 1. 在协程里调用同步阻塞函数

```python
# 错误：阻塞了整个事件循环
async def bad():
    time.sleep(5)  # 整个事件循环停摆 5 秒

# 正确：放到线程池
async def good():
    await asyncio.to_thread(time.sleep, 5)
```

### 2. 忘记 await

```python
async def bug():
    asyncio.sleep(1)  # 返回 coroutine，但没有 await，不执行！
    print("done")  # 立即输出，不管 sleep
```

### 3. 在 Jupyter 中运行 asyncio

Jupyter 已有运行中的事件循环，不能使用 `asyncio.run()`。直接用 `await`：

```python
# 在 Jupyter cell 中
await asyncio.sleep(1)  # 直接 await，无需 asyncio.run()
```

## 总结

Python 的 async/await 模型解决的是 I/O 密集型场景的并发问题。核心心智模型：

1. **事件循环**是调度中心，在单线程中轮流执行协程
2. **await** 是让出点，把控制权交还给事件循环
3. **gather** 和 **create_task** 是并发的主要手段
4. **尽量不要在协程中调用同步阻塞函数**，用 `asyncio.to_thread()` 或者找异步库替代

掌握这些，你就能用 Python 写出高性能的异步网络服务、爬虫、数据处理管道。
