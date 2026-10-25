package az.bugtrack.security;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import az.bugtrack.access.PermissionService;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Reads "Authorization: Bearer &lt;token&gt;" and puts the user into the SecurityContext.
 * Authorities = "ROLE_&lt;role&gt;" plus every permission of the role, so controllers can use
 * {@code @PreAuthorize("hasAuthority('user.manage')")}.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final PermissionService permissions;

    public JwtAuthFilter(JwtService jwtService, PermissionService permissions) {
        this.jwtService = jwtService;
        this.permissions = permissions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(PREFIX)) {
            try {
                AuthUser parsed = jwtService.parse(header.substring(PREFIX.length()));
                AuthUser user = new AuthUser(parsed.id(), parsed.email(), parsed.fullName(), parsed.role(),
                        permissions.forRole(parsed.role()));
                List<GrantedAuthority> authorities = new ArrayList<>();
                authorities.add(new SimpleGrantedAuthority("ROLE_" + user.role()));
                user.permissions().forEach(p -> authorities.add(new SimpleGrantedAuthority(p)));
                SecurityContextHolder.getContext()
                        .setAuthentication(new UsernamePasswordAuthenticationToken(user, null, authorities));
            } catch (JwtException | IllegalArgumentException e) {
                // invalid or expired token: the request continues as anonymous and gets 401
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }
}
