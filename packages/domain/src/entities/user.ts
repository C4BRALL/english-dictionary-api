import type { Email } from '../value-objects/email.js';

export type UserId = string;

export interface UserProps {
  id: UserId;
  name: string;
  email: Email;
  passwordHash: string;
  createdAt: Date;
}

export class User {
  readonly id: UserId;
  readonly name: string;
  readonly email: Email;
  readonly passwordHash: string;
  readonly createdAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.createdAt = props.createdAt;
  }

  toProfile(): UserProfile {
    return {
      id: this.id,
      name: this.name,
      email: this.email.value,
      createdAt: this.createdAt,
    };
  }
}

export type UserProfile = Omit<UserProps, 'email' | 'passwordHash'> & {
  email: string;
};
