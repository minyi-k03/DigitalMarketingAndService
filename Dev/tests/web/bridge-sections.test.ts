import { describe, expect, it } from 'vitest';
import { bridgeSections } from '../../src/web/bridge/sections';

describe('브릿지 화면 배치 순서 [T28][S18][S19][V-05]', () => {
  it('V-05 IMMEDIATE_TERMINATION 항목은 백업 체크리스트가 사유(행동 영역) 위에 먼저 온다', () => {
    expect(
      bridgeSections({ backupFirst: true, backupChecklist: ['사진 내려받기', '파일 옮기기'] }),
    ).toEqual(['backup', 'guide', 'action']);
  });

  it('V-05 백업 체크리스트가 없는 항목은 백업 영역을 만들지 않는다', () => {
    expect(bridgeSections({ backupFirst: false })).toEqual(['guide', 'action']);
    expect(bridgeSections({ backupFirst: false, backupChecklist: [] })).toEqual([
      'guide',
      'action',
    ]);
  });

  it('V-05 즉시 종료형이어도 체크리스트가 없거나 비어 있으면 백업 영역을 만들지 않는다', () => {
    expect(bridgeSections({ backupFirst: true })).toEqual(['guide', 'action']);
    expect(bridgeSections({ backupFirst: true, backupChecklist: [] })).toEqual(['guide', 'action']);
  });

  it('체크리스트가 있어도 즉시 종료형이 아니면 가이드 다음, 행동 영역 앞에 둔다', () => {
    expect(bridgeSections({ backupFirst: false, backupChecklist: ['설정 내보내기'] })).toEqual([
      'guide',
      'backup',
      'action',
    ]);
  });
});
