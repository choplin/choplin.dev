---
title: 'Zig言語とpgzxによるPostgreSQL拡張開発の紹介'
description: '「より良いC」を目指す Zig 言語と pgzx フレームワークで、PostgreSQL の拡張機能を開発する方法を紹介する。'
pubDate: 'Dec 17 2024'
commentId: 'postgres-extension-zig-pgzx'
---

この記事は[PostgreSQLアドベントカレンダー](https://qiita.com/advent-calendar/2024/postgresql)の15日目の記事です。

## PostgreSQLと拡張言語

PostgreSQLには多くのよい特徴がありますが、その一つに拡張性の高さを挙げる人は多いでしょう。PostgreSQLが提供する拡張機能は、多くのDBMSで提供されている[ユーザー定義関数](https://www.postgresql.jp/document/16/html/xfunc.html)のみならず、[ユーザー定義型](https://www.postgresql.jp/document/16/html/xtypes.html)、[インデックス](https://www.postgresql.jp/document/16/html/indexam.html)、[バックグラウンドワーカー](https://www.postgresql.jp/document/16/html/bgworker.html)、[外部データラッパ](https://www.postgresql.jp/document/16/html/fdwhandler.html)など多岐に渡ります。最近でもPostgreSQL 12でテーブルアクセスメソッドでのなど、コミュニティ内での議論によって必要性と価値が認められた場合には新たな拡張機能が追加されています。

PostgreSQLの本体とともに提供される拡張機能はcontribと呼ばれ、特に追加のインストールなどなしに`CREATE EXTENSION`コマンドによって利用が可能です。[contribモジュール](https://www.postgresql.jp/document/16/html/contrib.html)を見るとそのバラエティに驚かされます。これらは単に並べられているだけではなく、PostgreSQL本体とともにメンテナンスされ、実運用において広く利用されているものも多く含まれています。

近年ではこれらの拡張機能を用いて、[OrioleDB](https://www.orioledb.com/)や[TimescaleDB](https://www.timescale.com/)などのように、PostgreSQLをベースにした新たなプロダクトを提供する会社も数多く出てきています。RDBMSをスクラッチで開発するとなると途轍もない労力がかかりますし、OSSをフォークするとしてもアップストリームの追従は容易ではありません。PostgreSQLの高い拡張性が、小さなチームでも大きな価値を提供することを可能にしていると言えます。

## PostgreSQL拡張の実装言語

PostgreSQL本体はご存知のようにC言語で実装されています。[手続き型言語によるユーザー定義関数](https://www.postgresql.jp/document/16/html/xplang.html)などの一部の例外を除き、PostgreSQLの拡張機能はC言語での実装が必要となることが一般的です。高度な拡張を実装しようとするとPostgreSQLの内部APIを呼び出す必要があるため、実装言語としてはC言語のABIに沿った関数呼び出しが可能であることが必須になります。

PostgreSQLではC言語を用いた拡張開発のために[拡張構築基盤](https://www.postgresql.jp/document/16/html/extend-pgxs.html)を提供しており、実装した拡張をビルドするためのMakefileや、PostgreSQLのヘッダファイルやライブラリへのリンクを容易に行うことができるようになっています。これらを用いることによって拡張開発の環境を用意することはできるのですが、肝心の実装でC言語が必須となると二の足を踏んでしまう方や個人的な好き嫌いで避けられる方もいるのではないかと思います。

そのように考えている方は結構いるようで、[ZomboDB](https://www.zombodb.com/)というElasticsearchをPostgreSQLのインデックスとして用いるプロダクトを提供する会社が、PostgreSQLの拡張をRustで実装できるようにする[pgrx](https://github.com/pgcentralfoundation/pgrx)というフレームワークを開発しています。pgrxは活発に開発されており、実際に彼らのプロダクトもpgrxを用いてRustで開発を行っているようです。RustはCやC++のようなシステムプログラミング言語でありながら、多くのモダンな言語機能を取り入れており、近年高い関心を得ています。pgrxも記事執筆時点で3,7kのGitHubスターを得ており、Rustへの高い関心が伺えます。

同じような発想のフレームワークとして[Zig](https://ziglang.org/)という言語によってPostgreSQLの拡張開発を行えるようにする[pgzx](https://github.com/xataio/pgzx)というフレームワークがあります。本記事ではZig言語とpgzxによる拡張開発の簡単な紹介を行います。

## Zig言語

Zigは、シンプルさとパフォーマンスを重視して設計されたシステムプログラミング言語です。「より良いC」を目指しています。Rustが多くの言語機能を取り入れて感覚的にはC++に近いのに対して、ZigはそのシンプルさからC言語に近い感覚で記述できます。その一方で、モダンなプログラミングのニーズに応える多くの機能を提供します。モダンなシステムプログラミング言語におけるRustとは別の選択肢として近年注目を集めつつあります。JavaScriptランタイムの[Bun](https://bun.sh/)や金融取引の台帳記録DBの[TigerBeetle](https://tigerbeetle.com/)などに用いられており、耳にしたことがある人も多いかもしれません。

Zig言語には具体的には以下のような特徴があります：

1. シンプルで分かりやすい構文
   Zigの構文は非常にミニマルで、読みやすさが重視されています。複雑なマクロやテンプレートといった機能を排除し、コードの直感的な理解を助けます。

2. 安全性とパフォーマンスの両立
   メモリ管理は基本的に手動ですが、オプションで利用できる安全機能や静的解析により、典型的なC言語のバグ（バッファオーバーフローや未定義動作など）を防ぐ手助けをします。また、ゼロコスト抽象化の考え方を採用しており、ランタイムオーバーヘッドを最小限に抑えています。例えば、モダンな言語の多くで取り入れられているADTとパターンマッチは、enumとunion(共用体)とswitchによって同等のものが実現されています。最初にこの仕様を知った時は設計の巧みさに思わず唸ってしまいました。

3. 強力なコンパイル時計算
   Zigはコンパイル時に計算や処理を行える機能を標準でサポートしています。たとえば、コード生成や構造体のレイアウト計算、関数呼び出しなどをコンパイル中に実行できるため、効率的かつ柔軟なプログラム設計が可能です。この機能は、複雑な処理を実行時に行う必要を減らし、実行速度を向上させるだけでなく、コードの明確化にも寄与します。また、ジェネリクスは提供されていないのですが、コンパイル時に型を値として扱うことができ、複数の型を扱う関数を実装することが可能になっています。

4. C言語との高い互換性
   ZigはC言語のヘッダファイルを直接インポートできるため、既存のCライブラリとの統合が非常に簡単です。また、他の言語にない特徴として、構造体のメモリ配置や関数の呼び出し規約を明示的に指定することができ、C ABIとの相互運用性が強く意識されています。。PostgreSQLのようなCで実装されたプロジェクトを扱う場合、この互換性は大きなメリットとなります。

5. シンプルなビルドシステム
   Zigは独自のビルドツールを提供しており、複雑なMakefileやCMakeを使用する必要がありません。これにより、プロジェクトの構築が簡素化されます。

ZigはPostgreSQLの拡張開発において、C言語の煩雑さを避けつつ、軽量で高速なコードを書くのに適した選択肢となる可能性があります。この特性がpgzxのようなフレームワークと相性が良く、PostgreSQLの拡張開発をより簡単に行えるようになることが期待されいます。

## pgzxを用いたPostgreSQL拡張の開発

上で述べたように、Zig言語を用いてPostgreSQLの拡張を開発するためのフレームワークとしてpgzxが提供されています。pgzxは[Xata](https://xata.io/)という、これまたPostreSQLをベースにしたプロダクトの提供を行う会社によって開発されています。ただ、pgzxはpgrxほどには活発にメンテナンスされておらず、パブリックになっているリポジトリに限れば彼らが使っている様子もありません。下で試した内容を記しますが、結構不具合が残っている様子が見られます。pgzxというのがあるんだな程度で受け取って頂けるとよいかなと思います。

pgzxは[nix](https://nix.dev/)というパッケージマネージャーを用いた開発環境を提供しています。手で一通り揃えることも難しくないですが、nixを用いることで環境構築を大幅に簡略化できます。nixを新たにインストールする場合は[nix-installer](https://github.com/DeterminateSystems/nix-installer)の利用がおすすめです。

nixをインストールしたら、pgzxの開発環境をセットアップします。適当なディレクトリを作成し、その中で以下のコマンドを実行してください。

```console
nix flake init -t github:xataio/pgzx
```

そうすると次のようなファイルが生成されます。

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

`build.zig`と`build.zig.zon`はZigが提供するビルドツールの設定です。pgzxではZigのビルドツールを利用してPostgreSQLの拡張をビルドします。

`flake.nix`、`flake.lock`、`devshell.nix`はnixを用いた開発環境の設定ファイルです。nixを用いることによってPostgreSQL拡張の開発に必要なツールやライブラリが揃った隔離環境を構築できるはずなのですが、残念ながらそのままでZig本体のインストールで参照しているバージョンが古くダウンロードに失敗してしまうため、利用することができませんでした。nixを用いずにローカルで開発することも可能なので、今回はこのまま進めます。

`extension`に入っている2つのファイルはPostgreSQLの拡張をご存知の方であればおなじみのものです。これらは拡張のインストール時にPostgreSQLによって読み込まれるファイルであり、C言語の拡張と全く同じものになります。デフォルトでは以下のような内容になっています。

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

そして`src`内の`.zig`のファイルが拡張の実装コードです。このように、pgzxではZig言語を利用しつつ、そのエコシステムの中で拡張開発が完結するように設計されています。

`src/main.zig`の中身は以下のようになっています。

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

C言語でPostgreSQLの開発を実装したことがある方は、C言語での実装にかなり近い形で記述されていることに驚かれるかもしれません。

`comptime`はZigでコンパイル時の処理を行う方法の一つであり、ここではC言語のマクロとして提供されている`PG_MODULE_MAGIC`や`PG_FUNCTION_V1`などのC言語の拡張APIを呼び出しています。

`fn hello() ![:0]const u8`はZigの関数定義です。Zigは先述の通りC言語との互換性を重視しており、基本型やポインタなどは直接扱うことができます。ここでの`[:0]`はnull-terminatedは配列であることを示して、`u8`は符号なしの8bitの数値を示しているため、この型はC言語での文字列であるnull-terminatedのchar配列と同じ型になります。(!やconstの説明は省きます)

このコードは以下のようにビルドすることができます。

```console
zig build
```

pgzxの制限上、一回目のビルドは必ず失敗します。エラーメッセージに従って、`build.zig.zon`に`.hash = ....`という行を追加してあげる必要があります。

再度ビルドコマンドを実行して、ビルドが成功すると、`zig-out`というディレクトリの中に拡張の共有ライブラリが生成されます。

```console
└── zig-out
    └── my_extension.dylib
```

この共有ライブラリはC言語での拡張と全く同じようにPostgreSQL内で利用することができます。共有ライブラリと拡張用のファイル群は、以下のようにビルドの際にPostgreSQLのインストールディレクトリを指定することで、PostgreSQL内にコピーされます。

```console
zig build -p $PGHOME
```

というのが期待される動作だったんですが、ローカルのMacで試した範囲ではなぜか微妙に異なるディレクトリにコピーされてしまいました。どこにコピーすればいいかは分かるので、結局手動でコピーすることにしました。

```console
cp zig-out/my_extension.dylib $PGHOME/lib/postgresql
cp extension/* $PGHOME/share/postgresql/extension
```

これで拡張のビルドとインストールは完了です。PostgreSQLに接続して、以下のようコマンドを実行することによって拡張を利用することができます。

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

## まとめ

本記事ではZig言語の簡単な紹介と、pgzxを用いたZig言語によるPostgreSQL拡張開発の方法の説明を行いました。正直なところpgzxはかなり荒削りな状態であり、本格的な開発に用いるにはまだまだ早そうという印象でした。Zig言語自体も発展途上の言語であり、バージョンごとに言語仕様も含めた大幅な変更が入ることが多くあります。Zig言語は大きな可能性のある言語であるので、成熟したものを使うというよりは、Zig言語自体を試すきっかけとしてpgzxを使ってみたり、あるいはZig言語そのものを進歩させていくという気概でpgzx自体の開発に取り組むとよいのではないかと思います。
