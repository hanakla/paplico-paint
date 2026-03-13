'use client';

import { useState } from 'react';
import { proxy, useSnapshot } from 'valtio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// テスト用のValtio状態
interface TestUser {
  id: string;
  name: string;
  age: number;
  email: string;
}

interface TestState {
  // プリミティブ値
  counter: number;
  message: string;

  // ネストしたオブジェクト
  user: TestUser;

  // Map
  users: Map<string, TestUser>;

  // 配列
  items: string[];

  // 深いネスト
  deep: {
    level1: {
      level2: {
        value: string;
        count: number;
      };
    };
  };
}

const testState = proxy<TestState>({
  counter: 0,
  message: 'Hello Valtio',
  user: {
    id: '1',
    name: 'John Doe',
    age: 30,
    email: 'john@example.com',
  },
  users: new Map([
    ['1', { id: '1', name: 'Alice', age: 25, email: 'alice@example.com' }],
    ['2', { id: '2', name: 'Bob', age: 35, email: 'bob@example.com' }],
    ['3', { id: '3', name: 'Charlie', age: 28, email: 'charlie@example.com' }],
  ]),
  items: ['item1', 'item2', 'item3'],
  deep: {
    level1: {
      level2: {
        value: 'deep value',
        count: 42,
      },
    },
  },
});

export default function ValtioTestPage() {
  const snap = useSnapshot(testState);
  const [updateLog, setUpdateLog] = useState<string[]>([]);

  const logUpdate = (action: string, result: 'SUCCESS' | 'FAILED') => {
    const timestamp = new Date().toLocaleTimeString();
    setUpdateLog((prev) => [...prev, `[${timestamp}] ${action} - ${result}`]);
  };

  // プリミティブ値の更新（常に動作）
  const updateCounter = () => {
    testState.counter += 1;
    logUpdate('Counter increment', 'SUCCESS');
  };

  const updateMessage = () => {
    testState.message = `Updated at ${Date.now()}`;
    logUpdate('Message update', 'SUCCESS');
  };

  // ネストしたオブジェクトの更新（shallow only）
  const updateUserName_Shallow = () => {
    // ❌ これは検知されない
    testState.user.name = `John-${Date.now()}`;
    logUpdate('User name (direct mutation)', 'FAILED');
  };

  const updateUserName_Deep = () => {
    // ✅ これは検知される
    testState.user = { ...testState.user, name: `John-${Date.now()}` };
    logUpdate('User name (object replacement)', 'SUCCESS');
  };

  // Map内オブジェクトの更新
  const updateMapUser_Shallow = () => {
    // ❌ これは検知されない
    const user = testState.users.get('1');
    if (user) {
      user.age += 1;
      logUpdate('Map user age (direct mutation)', 'FAILED');
    }
  };

  const updateMapUser_Deep = () => {
    // ✅ これは検知される
    const user = testState.users.get('1');
    if (user) {
      const newUsers = new Map(testState.users);
      newUsers.set('1', { ...user, age: user.age + 1 });
      testState.users = newUsers;
      logUpdate('Map user age (Map replacement)', 'SUCCESS');
    }
  };

  // 配列内要素の更新
  const updateArrayItem_Shallow = () => {
    // ❌ これは検知されない
    testState.items[0] = `updated-${Date.now()}`;
    logUpdate('Array item (direct mutation)', 'FAILED');
  };

  const updateArrayItem_Deep = () => {
    // ✅ これは検知される
    testState.items = [...testState.items];
    testState.items[0] = `updated-${Date.now()}`;
    logUpdate('Array item (array replacement)', 'SUCCESS');
  };

  // 配列への要素追加
  const addArrayItem_Push = () => {
    // ❌ これは検知されない場合がある
    testState.items.push(`new-${Date.now()}`);
    logUpdate('Array push (direct mutation)', 'FAILED');
  };

  const addArrayItem_Spread = () => {
    // ✅ これは確実に検知される
    testState.items = [...testState.items, `new-${Date.now()}`];
    logUpdate('Array add (spread operator)', 'SUCCESS');
  };

  // 配列からの要素削除
  const removeArrayItem_Splice = () => {
    // ❌ これは検知されない場合がある
    if (testState.items.length > 3) {
      testState.items.splice(-1, 1);
      logUpdate('Array splice (direct mutation)', 'FAILED');
    }
  };

  const removeArrayItem_Filter = () => {
    // ✅ これは確実に検知される
    if (testState.items.length > 3) {
      testState.items = testState.items.slice(0, -1);
      logUpdate('Array remove (slice)', 'SUCCESS');
    }
  };

  // 深いネストの更新
  const updateDeepNested_Shallow = () => {
    // ❌ これは検知されない
    const o = testState.deep.level1;
    o.level2.count += 1;
    logUpdate('Deep nested (direct mutation)', 'FAILED');
  };

  const updateDeepNested_Deep = () => {
    // ✅ これは検知される
    testState.deep = {
      ...testState.deep,
      level1: {
        ...testState.deep.level1,
        level2: {
          ...testState.deep.level1.level2,
          count: testState.deep.level1.level2.count + 1,
        },
      },
    };
    logUpdate('Deep nested (full replacement)', 'SUCCESS');
  };

  const clearLog = () => {
    setUpdateLog([]);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Valtio Shallow Update Test</h1>
        <p className="text-muted-foreground">
          Valtioのshallow update制約を実際に確認できるテストページです。
          各ボタンを押して、UIが更新されるかどうかを確認してください。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 現在の状態表示 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>現在の状態 (useSnapshot)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">プリミティブ値</h4>
                <p>
                  Counter: <Badge variant="secondary">{snap.counter}</Badge>
                </p>
                <p>
                  Message: <Badge variant="secondary">{snap.message}</Badge>
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">ネストしたオブジェクト</h4>
                <p>
                  User Name: <Badge variant="secondary">{snap.user.name}</Badge>
                </p>
                <p>
                  User Age: <Badge variant="secondary">{snap.user.age}</Badge>
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">Map内のユーザー</h4>
                {Array.from(snap.users.entries()).map(([id, user]) => (
                  <div key={id} className="flex gap-2 mb-1">
                    <Badge variant="outline">{user.name}</Badge>
                    <Badge variant="outline">Age: {user.age}</Badge>
                  </div>
                ))}
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">配列</h4>
                <div className="flex flex-wrap gap-1">
                  {snap.items.map((item, index) => (
                    <Badge key={index} variant="outline">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">深いネスト</h4>
                <p>
                  Deep Value:{' '}
                  <Badge variant="secondary">
                    {snap.deep.level1.level2.value}
                  </Badge>
                </p>
                <p>
                  Deep Count:{' '}
                  <Badge variant="secondary">
                    {snap.deep.level1.level2.count}
                  </Badge>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* テストボタン */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shallow Update テスト</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2 text-green-600">
                  ✅ 動作するパターン
                </h4>
                <div className="space-y-2">
                  <Button onClick={updateCounter} className="w-full">
                    Counter +1 (プリミティブ)
                  </Button>
                  <Button onClick={updateMessage} className="w-full">
                    Message更新 (プリミティブ)
                  </Button>
                  <Button onClick={updateUserName_Deep} className="w-full">
                    User名前更新 (オブジェクト置換)
                  </Button>
                  <Button onClick={updateMapUser_Deep} className="w-full">
                    Map User年齢+1 (Map置換)
                  </Button>
                  <Button onClick={updateArrayItem_Deep} className="w-full">
                    配列要素更新 (配列置換)
                  </Button>
                  <Button onClick={addArrayItem_Spread} className="w-full">
                    配列要素追加 (スプレッド)
                  </Button>
                  <Button onClick={removeArrayItem_Filter} className="w-full">
                    配列要素削除 (slice)
                  </Button>
                  <Button onClick={updateDeepNested_Deep} className="w-full">
                    深いネスト更新 (完全置換)
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2 text-red-600">
                  ❌ 動作しないパターン
                </h4>
                <div className="space-y-2">
                  <Button
                    onClick={updateUserName_Shallow}
                    variant="destructive"
                    className="w-full"
                  >
                    User名前更新 (直接変更)
                  </Button>
                  <Button
                    onClick={updateMapUser_Shallow}
                    variant="destructive"
                    className="w-full"
                  >
                    Map User年齢+1 (直接変更)
                  </Button>
                  <Button
                    onClick={updateArrayItem_Shallow}
                    variant="destructive"
                    className="w-full"
                  >
                    配列要素更新 (直接変更)
                  </Button>
                  <Button
                    onClick={addArrayItem_Push}
                    variant="destructive"
                    className="w-full"
                  >
                    配列要素追加 (push)
                  </Button>
                  <Button
                    onClick={removeArrayItem_Splice}
                    variant="destructive"
                    className="w-full"
                  >
                    配列要素削除 (splice)
                  </Button>
                  <Button
                    onClick={updateDeepNested_Shallow}
                    variant="destructive"
                    className="w-full"
                  >
                    深いネスト更新 (直接変更)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ログ表示 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>更新ログ</CardTitle>
              <Button onClick={clearLog} variant="outline" size="sm">
                クリア
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {updateLog.map((log, index) => (
                  <div
                    key={index}
                    className={`text-xs p-2 rounded ${
                      log.includes('SUCCESS')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {log}
                  </div>
                ))}
                {updateLog.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    ボタンを押すとログが表示されます
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>解説</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-green-600 mb-2">
                ✅ 検知される更新パターン
              </h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>
                  プリミティブ値の直接代入: <code>state.counter = 1</code>
                </li>
                <li>
                  オブジェクトの完全置換:{' '}
                  <code>state.user = {'{...state.user, name: "new"}'}</code>
                </li>
                <li>
                  Mapの完全置換: <code>state.users = new Map(state.users)</code>
                </li>
                <li>
                  配列の完全置換: <code>state.items = [...state.items]</code>
                </li>
                <li>
                  配列への追加:{' '}
                  <code>state.items = [...state.items, newItem]</code>
                </li>
                <li>
                  配列からの削除:{' '}
                  <code>state.items = state.items.slice(0, -1)</code>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-red-600 mb-2">
                ❌ 検知されない更新パターン
              </h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>
                  Map内オブジェクトの直接変更:{' '}
                  <code>state.users.get(id).age = 30</code>
                </li>
                <li>
                  配列要素の直接変更: <code>state.items[0] = "new"</code>
                </li>
                <li>
                  配列への直接追加: <code>state.items.push(newItem)</code>
                </li>
                <li>
                  配列からの直接削除: <code>state.items.splice(index, 1)</code>
                </li>
                <li>
                  深いネストでの間接変更:{' '}
                  <code>const o = state.deep.level1; o.level2.count = 1</code>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="font-semibold text-blue-800 mb-2">
                💡 重要なポイント
              </p>
              <p className="text-blue-700">
                Valtioは<strong>shallow comparison</strong>
                でのみ変更を検知します。 そのため、深い変更を行う場合は必ず
                <strong>参照自体を変更</strong>する必要があります。
                これはパフォーマンス上の理由ですが、開発時の大きな制約となります。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
