---
title: C++ 智能指针完全指南
date: 2026-07-12 18:59:25
tags:
  - C++
  - 智能指针
  - RAII
  - 内存管理
categories:
  - C++
description: 深入讲解 C++ 智能指针 unique_ptr、shared_ptr、weak_ptr 的原理、用法与最佳实践，包括循环引用问题的解决方案。
---

## 为什么需要智能指针

在传统 C++ 中，`new` 和 `delete` 手动管理内存是万恶之源：

```cpp
void bad_function() {
    auto* data = new std::vector<int>(1000000);
    // 如果中间抛异常，data 永远不会被释放
    do_something(data);
    delete data;  // 可能永远执行不到
}
```

智能指针通过 **RAII**（资源获取即初始化）机制，将资源的生命周期绑定到对象的生命周期上。当智能指针离开作用域时，析构函数自动释放资源，异常安全自然而然地得到保障。

```cpp
void good_function() {
    auto data = std::make_unique<std::vector<int>>(1000000);
    do_something(data.get());
    // 无论正常返回还是异常抛出，data 都会被自动释放
}
```

## unique_ptr：独占所有权

`unique_ptr` 独占所指对象，不可复制，只能移动。它是开销最小的智能指针——大小等同裸指针，没有额外的引用计数。

### 基本用法

```cpp
#include <memory>
#include <iostream>

struct Resource {
    Resource()  { std::cout << "acquired\n"; }
    ~Resource() { std::cout << "released\n"; }
    void use()  { std::cout << "using resource\n"; }
};

void unique_ptr_demo() {
    // C++14 起推荐用 make_unique
    auto res = std::make_unique<Resource>();

    res->use();  // 和使用裸指针一样的语法

    // 不可复制
    // auto copy = res;  // 编译错误！

    // 可以移动
    auto moved = std::move(res);
    // res 现在是 nullptr

    // 手动释放（通常不需要）
    moved.reset();

    // 释放所有权但不销毁对象（用于对接 C API）
    Resource* raw = moved.release();  // 你负责 delete raw
    delete raw;
}
```

### 典型应用场景

**工厂函数返回多态对象：**

```cpp
class Animal {
public:
    virtual ~Animal() = default;
    virtual void speak() = 0;
};

class Dog : public Animal {
public:
    void speak() override { std::cout << "woof!\n"; }
};

class Cat : public Animal {
public:
    void speak() override { std::cout << "meow!\n"; }
};

std::unique_ptr<Animal> create_animal(const std::string& type) {
    if (type == "dog") return std::make_unique<Dog>();
    if (type == "cat") return std::make_unique<Cat>();
    return nullptr;
}
```

**PIMPL 惯用法（隐藏实现细节）：**

```cpp
// widget.h
class Widget {
public:
    Widget();
    ~Widget();  // 必须在 .cpp 中定义，因为 ~unique_ptr 需要完整类型
    void draw();
private:
    struct Impl;
    std::unique_ptr<Impl> pImpl;
};

// widget.cpp
struct Widget::Impl {
    // 大量的实现细节，头文件完全不可见
    std::string data;
    int state;
};

Widget::Widget() : pImpl(std::make_unique<Impl>()) {}
Widget::~Widget() = default;  // 关键：在 Impl 完整的上下文中定义
void Widget::draw() { /* 使用 pImpl */ }
```

### unique_ptr 与自定义删除器

```cpp
// 管理 FILE* 资源的 unique_ptr
auto file_deleter = [](FILE* f) {
    if (f) {
        std::cout << "closing file\n";
        fclose(f);
    }
};

std::unique_ptr<FILE, decltype(file_deleter)> file_ptr(
    fopen("test.txt", "r"), file_deleter
);

// 管理动态数组（C++14 起 make_unique 支持数组）
auto arr = std::make_unique<int[]>(100);
arr[0] = 42;  // 支持下标访问
```

## shared_ptr：共享所有权

`shared_ptr` 通过引用计数实现共享所有权。当最后一个 `shared_ptr` 销毁时，对象才被释放。

### 基本用法

```cpp
void shared_ptr_demo() {
    auto sp1 = std::make_shared<std::string>("hello shared_ptr");
    std::cout << "use_count: " << sp1.use_count() << "\n";  // 1

    {
        auto sp2 = sp1;  // 引用计数 +1
        std::cout << "use_count: " << sp2.use_count() << "\n";  // 2

        auto sp3 = sp1;  // 引用计数 +1
        std::cout << "use_count: " << sp3.use_count() << "\n";  // 3
    }
    // sp2 和 sp3 销毁，引用计数回落到 1

    std::cout << "use_count: " << sp1.use_count() << "\n";  // 1
}
```

### make_shared 的性能优势

```cpp
// 不好的写法：两次分配
auto sp = std::shared_ptr<Widget>(new Widget);
// 1. new Widget 分配对象内存
// 2. shared_ptr 构造函数分配控制块内存

// 好的写法：单次分配
auto sp = std::make_shared<Widget>();
// 对象和控制块在一次分配中完成，内存局部性更好
```

### shared_from_this 惯用法

当你需要在成员函数中获取自身的 `shared_ptr` 时：

```cpp
class Session : public std::enable_shared_from_this<Session> {
public:
    void start() {
        // 安全地获取指向自身的 shared_ptr
        auto self = shared_from_this();
        timer_.set_callback([self]() {
            self->on_timeout();  // 保证 Session 在回调执行期间存活
        });
    }

private:
    void on_timeout() { /* ... */ }
    Timer timer_;
};

// 使用
auto session = std::make_shared<Session>();
session->start();
```

注意：必须通过 `shared_ptr` 管理对象后才能调用 `shared_from_this()`，否则会抛出 `std::bad_weak_ptr`。

## weak_ptr：打破循环引用的关键

`shared_ptr` 最常见的坑是循环引用，导致内存泄漏：

```cpp
struct Node {
    std::shared_ptr<Node> next;
    std::shared_ptr<Node> prev;  // BUG: 循环引用！
};

auto a = std::make_shared<Node>();
auto b = std::make_shared<Node>();
a->next = b;
b->prev = a;
// a 和 b 离开作用域后引用计数各为 1（互相持有），永远不会释放
```

`weak_ptr` 不增加引用计数，专门用来打破这种循环：

```cpp
struct Node {
    std::shared_ptr<Node> next;
    std::weak_ptr<Node> prev;  // 用 weak_ptr，不增加引用计数
};

auto a = std::make_shared<Node>();
auto b = std::make_shared<Node>();
a->next = b;
b->prev = a;  // weak_ptr 不增加计数

// a 离开作用域：
// - 没有 shared_ptr 指向 a 的 next → b
// - b 的 prev 是 weak_ptr，不阻止销毁
// - a 被正确释放

// b 离开作用域：
// - 没有 shared_ptr 指向 b
// - b 被正确释放
```

### weak_ptr 的使用方式

```cpp
void weak_ptr_demo() {
    auto sp = std::make_shared<int>(42);
    std::weak_ptr<int> wp = sp;

    // 方式一：lock() 返回 shared_ptr，对象已销毁时返回空
    if (auto locked = wp.lock()) {
        std::cout << "value: " << *locked << "\n";
    } else {
        std::cout << "object already destroyed\n";
    }

    // 方式二：expired() 检查 + lock()（非原子，仅用于检查）
    if (!wp.expired()) {
        auto locked = wp.lock();  // 仍可能为空（多线程环境）
    }
}
```

### 观察者模式中的应用

```cpp
class Subject;  // 前置声明

class Observer {
public:
    virtual ~Observer() = default;
    virtual void update() = 0;
};

class Subject {
    std::vector<std::weak_ptr<Observer>> observers_;  // weak_ptr 不阻止 Observer 销毁

public:
    void attach(std::shared_ptr<Observer> obs) {
        observers_.push_back(obs);
    }

    void notify() {
        for (auto it = observers_.begin(); it != observers_.end(); ) {
            if (auto obs = it->lock()) {
                obs->update();
                ++it;
            } else {
                // Observer 已销毁，移除过期的 weak_ptr
                it = observers_.erase(it);
            }
        }
    }
};
```

## 移动语义与智能指针

智能指针与移动语义天然搭配：

```cpp
std::unique_ptr<Widget> factory() {
    auto p = std::make_unique<Widget>();
    p->configure();
    return p;  // 隐式 move，高效
}

void consumer(std::unique_ptr<Widget> w) {
    w->use();
}

// 调用链：所有权无缝转移
consumer(factory());
// 从 factory → 返回值临时对象 → consumer 参数，全程无深拷贝

// shared_ptr 同样支持移动
std::shared_ptr<Widget> sp1 = std::make_shared<Widget>();
std::shared_ptr<Widget> sp2 = std::move(sp1);  // sp1 变为空，sp2 接管，引用计数不变

// C++20 的 atomic<shared_ptr>（需要 C++20）
// std::atomic<std::shared_ptr<Widget>> atomic_sp;
```

## 最佳实践速查表

| 场景 | 推荐 | 原因 |
|------|------|------|
| 默认首选 | `unique_ptr` | 零开销，语义清晰 |
| 单一所有权的动态数组 | `unique_ptr<T[]>` | 自动 `delete[]` |
| 多个 owner 共享对象 | `shared_ptr` | 引用计数自动管理 |
| 缓存 / 观察者 / 打破循环 | `weak_ptr` | 不增加引用计数 |
| 对接 C API（所有权转移） | `unique_ptr::release()` | 显式交出所有权 |
| 创建智能指针 | `make_unique/make_shared` | 异常安全 + 性能优化 |

## 核心原则

1. **优先使用 `unique_ptr`**，需要共享时才升级到 `shared_ptr`
2. **用 `make_unique` / `make_shared` 而不是 `new`**，避免裸 `new` 出现在代码中
3. **循环引用用 `weak_ptr` 打破**：双向链表、树结构的父指针、观察者模式
4. **不要用智能指针管理栈对象**：智能指针调用 `delete`，栈对象不需要
5. **析构函数中 `shared_ptr` 的 `~shared_ptr` 要有完整类型**，否则是未定义行为
6. **线程安全只限于引用计数**：`shared_ptr` 的引用计数操作是线程安全的，但所指对象的访问需要你自己加锁

掌握了这些，你就可以告别 `delete`、告别烦人的内存泄漏查 bug，把精力放在真正重要的业务逻辑上。
