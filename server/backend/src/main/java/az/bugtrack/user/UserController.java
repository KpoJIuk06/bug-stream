package az.bugtrack.user;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Users for pickers (@mentions, assignee) — available to everyone signed in.
 * Managing users lives in the admin panel: {@link az.bugtrack.admin.AdminUserController}.
 * There is no self-registration: closed corporate network (local accounts or LDAP).
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    @GetMapping
    public List<UserDto> list(@RequestParam(defaultValue = "") String q,
                              @RequestParam(defaultValue = "false") boolean includeInactive) {
        return service.search(q, includeInactive);
    }

    @GetMapping("/{id}")
    public UserDto get(@PathVariable UUID id) {
        return service.get(id);
    }
}
