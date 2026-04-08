import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'] || this.extractFromBearer(request.headers.authorization);
    
    if (!userId) {
      throw new UnauthorizedException('Missing authentication. Use x-user-id header or Bearer token');
    }
    
    request.userId = userId;
    return true;
  }

  private extractFromBearer(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7);
    // TODO: Validate Clerk JWT token here
    // For now, extract user ID from dev token format: dev-user:123
    if (token.startsWith('dev-user:')) {
      return token.substring(9);
    }
    return token;
  }
}
