---
title: 'WSL2 で常時起動サーバーを立てて Tailscale 経由で SSH する'
description: 'Windows 上の WSL2 を常時起動のサーバーにし、外から Tailscale 経由で SSH で入れるようにする。mirrored networking と、自動ログイン・自動起動まわりの設定メモ。'
pubDate: 'Jul 14 2026'
commentId: 'wsl-tailscale-ssh-ja'
---

Windows マシン（ミニ PC）の上で動かしている WSL2 を、常時起動のサーバーとして運用し、外から Tailscale 経由で SSH で入れるようにした。動いた構成を作業メモとして残しておく。

WSL も Tailscale も動きの速い領域なので、以下は 2026 年 7 月時点、次の環境での話である。

- Windows 11 25H2（build 10.0.26200.8875）
- WSL 2.7.10.0 / カーネル 6.18.33.2
- ディストリビューションは NixOS-WSL

後述の mirrored networking mode は Windows 11 22H2 以上・WSL 2.0 系以上でしか使えない。

## 構成の全体像

Windows 側にアカウントを2つ用意した。

- **普段使いのアカウント** — Tailscale はこちらで認証・設定している。
- **`hermes`（サーバー用）** — 自動ログインし、WSL の起動と画面の自動ロックを担う。Tailscale は持たせていない。

記事は2部構成で、前半が「外から入れるようにする（リモートアクセス）」、後半が「無人で立ち上がり続けるようにする（常時起動）」である。

## リモートアクセス編

### WSLのネットワーク構成

外から tailnet 上のアドレスの 22 番へ SSH しても、WSL の sshd には届かない。

WSL2 はデフォルトでは NAT モードで動く。WSL は Windows ホストとは別の IP アドレスを持つ仮想マシンであり、Windows からは外部のホストのように見える。一方 Tailscale のクライアントは Windows 側で動いていて、tailnet 上の IP アドレスは Windows ホストに割り当てられる。つまり tailnet 経由で 22 番ポートを叩いても、そこにいるのは Windows であって WSL ではない。

これを解決するのが WSL2 の **mirrored networking mode** である。Windows のネットワークインターフェースを WSL 側にミラーするモードで、WSL が Windows と同じアドレスで listen できるようになる。結果として、Windows 側が受けた 22 番ポートへの接続が、そのまま WSL の sshd に届く。ポートフォワーディングを手で設定する必要はない。

他に考えられる方法として、NAT モードのまま `netsh interface portproxy` で転送する方法や、Tailscale を WSL の中で動かして WSL 自体を tailnet ノードにする方法があげられる。ここでは Tailscale を Windows ホスト側に置く構成を採ったので、mirrored モードを使っている。

### 1. `.wslconfig` で mirrored モードにする

`%USERPROFILE%\.wslconfig` に次を書く。

```ini
[wsl2]
networkingMode=mirrored
```

書き換えたら WSL を再起動する。

```powershell
wsl --shutdown
```

### 2. Tailscale を unattended mode にする

Windows 側の Tailscale クライアントで、システムトレイのアイコンを右クリックし、**Preferences → Run unattended** を選ぶ。確認ダイアログで Yes を選択する。

Tailscale の Windows クライアントは、通常はログインしているユーザーのセッション内で動く。この構成では Tailscale を認証したのは普段使いのアカウントだが、常時ログオンしているのは別アカウントの `hermes` で、そちらは Tailscale を持たない。そのままだと、Tailscale を認証したユーザーがログオンしている間しか tailnet に繋がらず、`hermes` がログオンしている状態では切れてしまう。

unattended mode を有効にすると、Tailscale はユーザーセッションに依存せず動き続ける。これで `hermes` が自動ログインしていても tailnet 接続が維持される。

### 3. WSL 側で sshd を立てる

sshd は通常どおり立てればよい。ただし WSL の起動時に自動で上がるよう、systemd（ディストリビューションによっては別の init）で有効化しておく。以下は NixOS-WSL の例。

`/etc/nixos/configuration.nix` に、鍵を宣言的に置いてパスワード認証は無効にする。NixOS-WSL は systemd で動くので、`enable = true` で起動時に sshd も自動で立ち上がる。

```nix
{ config, pkgs, ... }:

{
  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      PermitRootLogin = "no";
    };
  };

  # 自分の公開鍵に置き換える
  users.users.user.openssh.authorizedKeys.keys = [
    "ssh-ed25519 AAAA..."
  ];
}
```

反映する。

```bash
sudo nixos-rebuild switch
```

### 4. 接続する

あとは tailnet 上のマシン名で入れる。この名前は tailnet に参加している Windows ホストのマシン名に由来するもので、Tailscale の管理画面で確認できる。

```bash
ssh user@your-host.your-tailnet.ts.net
```

### ファイアウォールの設定は不要

今回の構成ではWindows Firewall も Hyper-V Firewall も、ルールは何も足していないが、tailnet 経由ではアクセス可能になっている。

**Windows Defender Firewall（ホスト側）** — Tailscale の Windows クライアントは、自分のインターフェース宛の inbound を許可するルール（`Tailscale-In`）を自動で追加する。LAN 側インターフェースの 22 番にはそうした許可がないので、既定の inbound 遮断のまま。実際、LAN 内の別マシンから Windows の `192.168` アドレスの 22 番へは繋がらず、tailnet 経由でのみ繋がった。

**Hyper-V Firewall（WSL VM 側）** — mirrored モードでは、この層はこの経路を制御していなかった。Windows の PowerShell で WSL VM の Hyper-V Firewall 設定を見ると、inbound の既定は Block、22 番を通す許可ルールも無い。それでも tailnet 経由の SSH は通る。さらに `LoopbackEnabled` を False にしても通り続けた。既定 Block・許可ルール無し・ループバック免除無しの状態で通るのだから、この inbound は Hyper-V Firewall の管理下にない、と推測できる。

```powershell
# WSL VM の Hyper-V Firewall 設定（VMCreatorId は WSL 固定値）
Get-NetFirewallHyperVVMSetting -PolicyStore ActiveStore `
  -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'
```


なお mirrored モードでは Windows と Linux がポート空間を共有するため、Windows 側で OpenSSH Server を有効にしていると 22 番が衝突する。サーバー機では無効にしておくとよい。

## 常時起動編

WSL のディストリビューションは、誰かが Windows にログオンして `wsl.exe` が呼ばれるまで起動しない。Windows の再起動後に自動で WSL を起動させるには、Windows 側の自動ログインとタスクスケジューラを組み合わせる。

### 5. 自動ログイン

`hermes` を自動ログインさせる。Sysinternals の [Autologon](https://learn.microsoft.com/en-us/sysinternals/downloads/autologon) を使うと、資格情報を LSA に暗号化して保存してくれる（レジストリに平文で書く `DefaultPassword` より安全）。

これで Windows が起動するたびに `hermes` がログオンし、次の2つのタスクが発火する土台ができる。

### 6. WSL の自動起動（タスクスケジューラ）

`hermes` のログオンをトリガーに、WSL を起動して握りっぱなしにするタスクを登録する。アクションはこれ。

```
wsl.exe -d NixOS bash -lc "sleep infinity"
```

ログオントリガーは自動ログインのたびに発火し、再起動のたびにも走る。ログオンより前には発火しないので、自動ログインとの順序や「再起動後に実行」の追加設定は要らない。

### 7. 画面の自動ロック

自動ログインは、起動のたびに画面を開いたまま（ログオン済み・ロックなし）にする。これを避けるため、即座に画面をロックするタスクを登録する。

```
rundll32.exe user32.dll,LockWorkStation
```

ロックしてもセッションは生きたままなので、WSL は動き続ける。

### 8. スリープ・休止状態を止める

Windows がスリープや休止状態に入ることを防ぐために、電源オプションで、AC 給電時のスリープと休止状態をいずれも「なし」にする。

```powershell
# 確認（AC のインデックスが 0 なら「なし」）
powercfg /query SCHEME_CURRENT SUB_SLEEP
```

---

以上で、Windows を再起動しても無人で `hermes` が自動ログインし、WSL が起動して sshd が上がり、外から tailnet 経由で SSH で入れる状態になる。
