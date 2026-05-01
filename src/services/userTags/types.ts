export type TagKind =
  | 'expertise'
  | 'skill'
  | 'position'
  | 'topic'
  | 'what_i_offer';

export type TagIntent = 'WANT' | 'OFFER';

export interface UserTag {
  tag_id: number;
  intent: string;
  kind: string;
  subject_group?: string;
  subject?: string;
  language?: string;
}

export interface UserTagListVO {
  user_tags: UserTag[];
}

export interface ReplaceUserTagsPayload {
  kind: TagKind;
  intent: TagIntent;
  subject_groups: string[];
  language?: string;
}

export interface ReplaceUserTagsVO {
  user_id: number;
  kind: string;
  intent: string;
  tag_ids: number[];
  replaced: boolean;
}
