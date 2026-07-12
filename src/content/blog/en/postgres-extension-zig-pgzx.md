---
title: 'PostgreSQL extension development with Zig and pgzx'
description: "An introduction to developing PostgreSQL extensions using the Zig language — which aims to be 'a better C' — and the pgzx framework."
pubDate: 'Dec 17 2024'
commentId: 'postgres-extension-zig-pgzx'
translationKey: 'postgres-extension-zig-pgzx'
---

This article is day 15 of the [PostgreSQL Advent Calendar 2024](https://qiita.com/advent-calendar/2024/postgresql).

## PostgreSQL and extension languages

PostgreSQL has many good qualities, and many people would name its high extensibility as one of them. The extension mechanisms it provides span not only the [user-defined functions](https://www.postgresql.jp/document/16/html/xfunc.html) offered by many DBMSs, but also [user-defined types](https://www.postgresql.jp/document/16/html/xtypes.html), [indexes](https://www.postgresql.jp/document/16/html/indexam.html), [background workers](https://www.postgresql.jp/document/16/html/bgworker.html), [foreign data wrappers](https://www.postgresql.jp/document/16/html/fdwhandler.html), and more. Even recently, new extension points continue to be added when the community discussion recognizes their necessity and value — such as table access methods added in PostgreSQL 12.

The extensions shipped with PostgreSQL itself are called contrib, and can be used with the `CREATE EXTENSION` command without any additional installation. Looking at the [contrib modules](https://www.postgresql.jp/document/16/html/contrib.html), the variety is striking. These aren't just listed there — many are maintained together with PostgreSQL core and are widely used in production.

In recent years, using these extension mechanisms, a growing number of companies offer new products based on PostgreSQL, such as [OrioleDB](https://www.orioledb.com/) and [TimescaleDB](https://www.timescale.com/). Developing an RDBMS from scratch takes an enormous amount of effort, and even forking an OSS one, keeping up with upstream is far from easy. PostgreSQL's high extensibility makes it possible for even a small team to deliver great value.

## Implementation languages for PostgreSQL extensions

PostgreSQL core is, as you know, implemented in C. With some exceptions such as [user-defined functions in procedural languages](https://www.postgresql.jp/document/16/html/xplang.html), PostgreSQL extensions generally need to be implemented in C. Implementing an advanced extension requires calling PostgreSQL's internal APIs, so the implementation language must be able to make function calls that follow the C ABI.

For extension development in C, PostgreSQL provides an [extension building infrastructure](https://www.postgresql.jp/document/16/html/extend-pgxs.html) — Makefiles for building your extension, and easy linking against PostgreSQL's headers and libraries. These let you set up an extension development environment; but when the actual implementation requires C, some people hesitate, or avoid it out of personal preference.

Quite a few people feel that way, and [ZomboDB](https://www.zombodb.com/) — a company offering a product that uses Elasticsearch as a PostgreSQL index — developed a framework called [pgrx](https://github.com/pgcentralfoundation/pgrx) that lets you implement PostgreSQL extensions in Rust. pgrx is actively developed, and they apparently build their own product in Rust using pgrx. Rust is a systems programming language like C and C++, yet it incorporates many modern language features and has drawn great interest recently. pgrx has 3.7k GitHub stars at the time of writing, which shows the strong interest in Rust.

A framework with a similar idea is [pgzx](https://github.com/xataio/pgzx), which lets you develop PostgreSQL extensions in the [Zig](https://ziglang.org/) language. In this article I give a brief introduction to extension development with Zig and pgzx.

## The Zig language

Zig is a systems programming language designed with an emphasis on simplicity and performance. It aims to be "a better C." Whereas Rust incorporates many language features and feels close to C++, Zig's simplicity lets you write in a way that feels close to C. At the same time, it provides many features that meet the needs of modern programming. As an alternative to Rust among modern systems programming languages, it has been drawing attention lately. It's used in the JavaScript runtime [Bun](https://bun.sh/) and the financial-transaction ledger DB [TigerBeetle](https://tigerbeetle.com/), so many people may have heard of it.

Zig has, concretely, the following characteristics:

1. Simple, clear syntax
   Zig's syntax is very minimal, with an emphasis on readability. It excludes features like complex macros and templates, aiding an intuitive understanding of the code.

2. Both safety and performance
   Memory management is basically manual, but optional safety features and static analysis help prevent typical C bugs (buffer overflows, undefined behavior, and so on). It also adopts the idea of zero-cost abstractions, keeping runtime overhead to a minimum. For example, the ADTs and pattern matching adopted by many modern languages are realized here with enum, union, and switch. When I first learned this design, I couldn't help but be impressed by its cleverness.

3. Powerful compile-time computation
   Zig supports performing computation and processing at compile time as standard. For instance, code generation, struct layout computation, and function calls can be executed during compilation, enabling efficient and flexible program design. This reduces the need to do complex processing at runtime — improving execution speed and also clarifying the code. Also, while generics aren't provided, you can treat types as values at compile time, making it possible to implement functions that handle multiple types.

4. High compatibility with C
   Zig can import C header files directly, making integration with existing C libraries very easy. As a feature not found in other languages, you can explicitly specify struct memory layout and function calling conventions, with strong attention to interoperability with the C ABI. When working with a C-implemented project like PostgreSQL, this compatibility is a big advantage.

5. A simple build system
   Zig provides its own build tool, so you don't need complex Makefiles or CMake. This simplifies building a project.

For PostgreSQL extension development, Zig can be a good option for writing lightweight, fast code while avoiding C's complexity. This pairs well with a framework like pgzx, and it's hoped it will make PostgreSQL extension development easier.

## Developing a PostgreSQL extension with pgzx

As mentioned above, pgzx is provided as a framework for developing PostgreSQL extensions in Zig. pgzx is developed by [Xata](https://xata.io/), another company offering a PostgreSQL-based product. That said, pgzx isn't maintained as actively as pgrx, and at least in the public repository there's no sign that they use it themselves. I describe what I tried below, but there seem to be quite a few remaining bugs. Please take it as "there's a thing called pgzx" level of information.

pgzx provides a development environment using the [nix](https://nix.dev/) package manager. Assembling everything by hand isn't hard, but using nix greatly simplifies environment setup. If you're installing nix for the first time, I recommend the [nix-installer](https://github.com/DeterminateSystems/nix-installer).

Once you've installed nix, set up the pgzx development environment. Create a suitable directory and run the following command inside it.

```console
nix flake init -t github:xataio/pgzx
```

That generates files like the following.

```console
.
├── build.zig
├── build.zig.zon
├── devshell.nix
├── extension
│   ├── my_extension--0.1.sql
│   └── my_extension.control
├── flake.lock
├── flake.nix
├── mise.toml
├── README.md
└── src
    └── main.zig
```

`build.zig` and `build.zig.zon` are the settings for Zig's build tool. pgzx uses Zig's build tool to build the PostgreSQL extension.

`flake.nix`, `flake.lock`, and `devshell.nix` are configuration files for the nix-based development environment. Using nix, you should be able to build an isolated environment with the tools and libraries needed for PostgreSQL extension development — but unfortunately, the Zig version it referenced for installing Zig itself was old and the download failed, so I couldn't use it. It's also possible to develop locally without nix, so I'll proceed as is this time.

The two files under `extension` are familiar to anyone who knows PostgreSQL extensions. They're read by PostgreSQL when installing the extension, and are exactly the same as for a C extension. By default they contain the following.

```sql
\echo Use "CREATE EXTENSION my_extension" to load this file. \quit
CREATE FUNCTION hello() RETURNS TEXT
AS '$libdir/my_extension'
LANGUAGE C IMMUTABLE
```

```
# my_extension extension
comment = 'My extension short doc'
default_version = '0.1'
module_pathname = '$libdir/my_extension'
relocatable = true
```

And the `.zig` file under `src` is the extension's implementation code. In this way, pgzx is designed so that extension development is completed within Zig's ecosystem, using the Zig language.

The contents of `src/main.zig` are as follows.

```zig
const std = @import("std");
const pgzx = @import("pgzx");

comptime {
    pgzx.PG_MODULE_MAGIC();
    pgzx.PG_FUNCTION_V1("hello", hello);
}

fn hello() ![:0]const u8 {
    return "Hello, world!";
}
```

Those who have implemented PostgreSQL development in C may be surprised at how close this is to a C implementation.

`comptime` is one of Zig's ways to do compile-time processing; here it calls C extension APIs such as `PG_MODULE_MAGIC` and `PG_FUNCTION_V1`, which are provided as C macros.

`fn hello() ![:0]const u8` is a Zig function definition. As mentioned, Zig emphasizes compatibility with C and can handle primitive types and pointers directly. Here `[:0]` indicates a null-terminated array and `u8` indicates an unsigned 8-bit number, so this type is the same as a C string — a null-terminated char array. (I'll omit the explanation of `!` and `const`.)

This code can be built as follows.

```console
zig build
```

Due to a pgzx limitation, the first build always fails. Following the error message, you need to add a line `.hash = ....` to `build.zig.zon`.

Running the build command again, when the build succeeds, the extension's shared library is generated in a directory called `zig-out`.

```console
└── zig-out
    └── my_extension.dylib
```

This shared library can be used inside PostgreSQL exactly like a C extension. The shared library and the extension files are copied into PostgreSQL by specifying the PostgreSQL installation directory at build time, as follows.

```console
zig build -p $PGHOME
```

...is what was supposed to happen, but in what I tried on my local Mac, for some reason they were copied to slightly different directories. I know where they need to go, so in the end I copied them manually.

```console
cp zig-out/my_extension.dylib $PGHOME/lib/postgresql
cp extension/* $PGHOME/share/postgresql/extension
```

That completes building and installing the extension. Connect to PostgreSQL and run the following commands to use the extension.

```sql
> create extension my_extension;
CREATE EXTENSION
Time: 26.292 ms

> select hello();
     hello
---------------
 Hello, world!
(1 row)
```

## Summary

In this article I gave a brief introduction to the Zig language and a way to develop PostgreSQL extensions in Zig using pgzx. Honestly, pgzx is quite rough, and my impression is that it's still too early to use for serious development. Zig itself is also a language under development, and major changes — including to the language spec — often land version by version. Zig is a language with great potential, so rather than expecting something mature, it might be good to use pgzx as an opportunity to try Zig itself, or to take on developing pgzx itself with the spirit of advancing Zig.
