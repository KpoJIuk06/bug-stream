package az.bugtrack.eav;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Field definitions — the frontend builds filters (is_filterable, options) and the edit form from them.
 * GET /api/attributes?entityType=report&projectId=...
 */
@RestController
public class AttributeController {

    private final AttributeRegistry registry;

    public AttributeController(AttributeRegistry registry) {
        this.registry = registry;
    }

    @GetMapping("/api/attributes")
    public List<AttributeDef> list(@RequestParam(defaultValue = "report") String entityType,
                                   @RequestParam(required = false) UUID projectId) {
        return registry.forType(entityType, projectId);
    }
}
