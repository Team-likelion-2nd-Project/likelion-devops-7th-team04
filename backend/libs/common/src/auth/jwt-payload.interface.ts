// auth-service가 발급하고, api-gateway(JwtStrategy)가 검증하는 JWT payload 형태.
// 두 서비스가 동일한 형태를 공유해야 하므로 공통 라이브러리에 둡니다.
export interface JwtPayload {
  sub: number; // userId
  email: string;
  role: string;
}

// JwtStrategy.validate()의 반환값이 req.user 로 주입됩니다.
export interface AuthenticatedUser {
  userId: number;
  email: string;
  role: string;
}
