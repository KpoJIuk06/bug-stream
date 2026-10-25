package az.bugtrack.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import az.bugtrack.access.PermissionService;
import az.bugtrack.security.JwtAuthFilter;
import az.bugtrack.security.JwtService;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain apiSecurity(HttpSecurity http, JwtService jwtService, PermissionService permissions)
            throws Exception {
        http
            .csrf(csrf -> csrf.disable())                       // Bearer tokens only, no cookies
            .cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .httpBasic(b -> b.disable())
            .formLogin(f -> f.disable())
            .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/api/auth/refresh", "/api/auth/logout", "/api/auth/config",
                                 "/api/auth/email-code", "/api/auth/email-code/verify",
                                 "/api/auth/password/forgot", "/api/auth/password/link", "/api/auth/password/reset").permitAll()
                .requestMatchers("/actuator/health", "/error").permitAll()
                .requestMatchers("/api/ingest/**").permitAll()                  // site widget: access by project key
                .requestMatchers(HttpMethod.GET, "/api/files/**").permitAll()   // access by the signature in the URL
                .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()  // public share links (token in the URL)
                .requestMatchers("/api/admin/**").hasAuthority("admin.access")
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll())
            // Created here rather than as a @Component so Spring Boot does not register it a second time
            .addFilterBefore(new JwtAuthFilter(jwtService, permissions), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Placeholder: sign-in goes only through /api/auth/login + JWT. This bean disables
     * Spring Boot's built-in user ("Using generated security password" in the logs).
     */
    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException(username);
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();   // bcrypt by default
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        var cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(props.cors().allowedOriginPatterns());
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        cfg.setMaxAge(3600L);
        // The site widget posts reports from any origin; the project key decides which sites are allowed
        var ingest = new CorsConfiguration();
        ingest.setAllowedOriginPatterns(List.of("*"));
        ingest.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        ingest.setAllowedHeaders(List.of("X-Bug-Stream-Key", "X-Adtask-Key", "Content-Type"));
        ingest.setAllowCredentials(false);
        ingest.setMaxAge(3600L);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/ingest/**", ingest);   // registered before the general rule, so it wins
        source.registerCorsConfiguration("/api/**", cfg);
        return source;
    }
}
