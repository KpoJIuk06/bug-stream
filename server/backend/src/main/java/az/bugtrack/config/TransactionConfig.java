package az.bugtrack.config;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import javax.sql.DataSource;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.TransactionDefinition;

import az.bugtrack.security.CurrentUser;

/**
 * Transaction manager that, at the start of every transaction, tells the database
 * on whose behalf changes are made:  set_config('app.user_id', '<uuid>', true).
 * History triggers (entity_history, audit_log) take the author from there.
 *
 * Important: data changes must run inside @Transactional,
 * otherwise the history has no author.
 */
@Configuration
public class TransactionConfig {

    @Bean
    public DataSourceTransactionManager transactionManager(DataSource dataSource) {
        return new AuditingTransactionManager(dataSource);
    }

    static class AuditingTransactionManager extends DataSourceTransactionManager {

        AuditingTransactionManager(DataSource dataSource) {
            super(dataSource);
        }

        @Override
        protected void prepareTransactionalConnection(Connection con, TransactionDefinition definition)
                throws SQLException {
            super.prepareTransactionalConnection(con, definition);
            var user = CurrentUser.get();
            if (user.isPresent()) {
                try (PreparedStatement ps = con.prepareStatement("select set_config('app.user_id', ?, true)")) {
                    ps.setString(1, user.get().id().toString());
                    ps.execute();
                }
            }
        }
    }
}
