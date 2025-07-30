// Minimal supertest type declaration for test compilation
declare module 'supertest' {
  import { Server } from 'http';
  import { Express } from 'express';
  
  export interface Response {
    status: number;
    body: any;
    headers: Record<string, string>;
    text: string;
    type: string;
    charset: string;
    redirect: boolean;
    error: any;
    ok: boolean;
  }
  
  export interface Test extends Promise<Response> {
    expect(status: number): this;
    expect(status: number, callback: (err: Error) => void): this;
    expect(checker: (res: Response) => any): this;
    expect(field: string, value: string | RegExp): this;
    expect(field: string, value: string | RegExp, callback: (err: Error) => void): this;
    send(data: any): this;
    set(field: string, value: string): this;
    set(fields: Record<string, string>): this;
    auth(user: string, pass: string): this;
    query(query: any): this;
    field(name: string, value: any): this;
    attach(field: string, file: string, options?: any): this;
    redirects(count: number): this;
    timeout(ms: number | { response?: number; deadline?: number }): this;
    retry(count?: number): this;
    type(type: string): this;
    accept(type: string): this;
    unset(field: string): this;
  }
  
  export interface Agent {
    get(url: string): Test;
    post(url: string): Test;
    put(url: string): Test;
    head(url: string): Test;
    del(url: string): Test;
    delete(url: string): Test;
    options(url: string): Test;
    trace(url: string): Test;
    patch(url: string): Test;
  }
  
  function supertest(app: Express | Server | string): Agent;
  
  export default supertest;
}